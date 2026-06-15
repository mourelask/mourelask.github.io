---
title: "2d GI Series #3 - Simple gi raymarching"
description: "The third part of the 2d global illumination series covering raymarching our scene with the help of the distance field we generated on the second part"
pubDate: 2024-02-20
cover: "/media/blog/2d-gi-series-3-simple-gi-raymarching/card.png"
tags: ["unity", "render pipeline", "global illumination", "sdf", "raymarching"]
---
## Our goals for the third part

In this part we will implement a simple gi solution, by raymarching through our 2d scene, trying to reach the emissive sources. If you are not already familiar with raymarching i will try to explain the main points below, with the help of some small animations made with <a class="site-link" href="https://motioncanvas.io/">Motion Canvas</a>.

As the fragment shader runs for each pixel of our texture, we "cast" a number of rays. The number of rays and direction is not important for now.
<video src="/media/blog/2d-gi-series-3-simple-gi-raymarching/Raymarching_01.mp4" controls loop muted playsinline></video>
<figcaption>In this example we cast 8 rays per pixel, towards the 8 main directions</figcaption>

For each ray direction, we start raymarching our texture. Starting from the pixel position, we move towards the chosen direction for a specified constant <mark>step size</mark>. At the new point, we sample our texture and check if there is something there that our ray should collide with. If there is, we store the emission color of that pixel and stop. If not, we continue raymarching until we are either out of bounds or until we have reached our max steps count. On this case we store black color .

When we are done with all rays for this pixel we calculate the average color of the rays and return it. In practice that means that the more rays from a pixel that "collide" with an emissive source, the brighter that pixel will be.

<video src="/media/blog/2d-gi-series-3-simple-gi-raymarching/Raymarching_02.mp4" controls loop muted playsinline></video>
<figcaption>Here, we check the result of three different rays with a max step count of 7. The first one reaches a valid target in 3 steps. The second one goes out of bounds in 6 steps. The third one reaches the max step count without having collided with anything</figcaption>

But wait! What was the point of getting into that much trouble to generate the <mark>distance field</mark> in the previous step?
As you can see we could reach pretty much the same result without using a <mark>distance field</mark> representation of our scene! Well don't worry we didn't do all that work for nothing.. the distance field will help us optimize our raymarching code, and <mark>increase performance and accuracy</mark>.

Instead of using a constant <mark>step size</mark> while raymarching, we can use the <mark>distance field</mark> value of our current point as our step size. Since the distance field contains the distance of each pixel to the closest "object" the ray is safe to travel towards its direction for that distance without worrying that it will skip an object. That results in needing fewer steps to reach a solution, and minimizes artifacts from the fact that big step sizes could miss small "objects" altogether.

<video src="/media/blog/2d-gi-series-3-simple-gi-raymarching/Raymarching_03.mp4" controls loop muted playsinline></video>
<figcaption>Example of two of our previous rays, now optimized with the use of the distance field</figcaption>

## The Global Illumination pass

Well you should know the drill by now, lets add a <mark>GISimpleRaymarchingPass</mark> pass, that takes as **input** our <mark>sdf</mark> and <mark>emission</mark> textures, and **outputs** to a new <mark>GI</mark> one. As always don't forget to call the pass render function from our MyRenderPipeline <mark>Render()</mark> method. The code is quite straightforward, most of the raymarching code is ported from this great post by [Samuel Bigos](https://samuelbigos.github.io/posts/2dgi1-2d-global-illumination-in-godot.html) who created the same effect on the Godot engine. Let's focus on some interesting tidbits.

<details>
<summary>GI Pass</summary>

```cs
public partial class MyRenderPipeline
{
    private static Material _giSimpleRaymarchingMaterial;

    public class GISimpleRaymarchingPassData
    {
        public TextureHandle Emission;
        public TextureHandle Sdf;
        public TextureHandle GI;
    }
    
    public GISimpleRaymarchingPassData RenderGISimpleMarchingPass(Camera camera, RenderGraph renderGraph, TextureHandle emission, TextureHandle sdf)
    {
        if (_giSimpleRaymarchingMaterial == null) _giSimpleRaymarchingMaterial = CoreUtils.CreateEngineMaterial(Shader.Find("Hidden/MyPipeline/GISimpleRaymarching"));

        using (var builder = renderGraph.AddRenderPass<GISimpleRaymarchingPassData>("GIPass", out var passData, new ProfilingSampler("Global Illumination profiler")))
        {
            passData.Emission = builder.ReadTexture(emission);
            passData.Sdf = builder.ReadTexture(sdf);
            TextureHandle gi = CreateHDRColorTexture(renderGraph, "GI");
            passData.GI = builder.UseColorBuffer(gi, 0);

            builder.SetRenderFunc((GISimpleRaymarchingPassData data, RenderGraphContext context) =>
            {
                _giSimpleRaymarchingMaterial.SetTexture("_Emission", data.Emission);
                _giSimpleRaymarchingMaterial.SetTexture("_Sdf", data.Sdf);
                context.cmd.Blit(null, data.GI, _giSimpleRaymarchingMaterial);
            });

            return passData;
        }
    }
}
```
<figcaption>GISimpleRaymarchingPass.cs</figcaption>

</details>
<details>
<summary>GI Shader</summary>

```c
Shader "Hidden/MyPipeline/GISimpleRaymarching"
{
    Properties {}

    SubShader
    {
        Pass
        {
            Name "GISimpleRaymarchingPass"

            // No culling or depth
            Cull Off ZWrite Off ZTest Always

            HLSLPROGRAM
            #define  RAYS 16
            #define  MAXSTEPS 16
            #define  GOLDENANGLE 2*PI/RAYS
            #define  EMISSIONMULT 1.0

            #pragma vertex vert
            #pragma fragment frag
            #include "Transformations.hlsl"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 uv : TEXCOORD;
            };

            v2f vert(appdata v)
            {
                v2f o;
                o.vertex = TransformObjectToHClip(v.vertex.xyz);
                o.uv     = v.uv;
                return o;
            }

            Texture2D    _Sdf;
            SamplerState sampler_Sdf;

            float2 _NativeResolution;
            float2 _NativeTexelSize;

            float random(float2 st)
            {
                return frac(sin(dot(st.xy, float2(12.9898, 78.233))) * 43758.5453123);
            }

            bool raymarch(float2 origin, float2 dir, out float3 hit_color)
            {
                float cur_dist = 0.0;

                for (int i = 0; i < MAXSTEPS; i++)
                {
                    float2 sample_point = origin + dir * cur_dist;

                    // early exit if we hit the edge of the screen.
                    if (sample_point.x > _NativeResolution.x || sample_point.x < 0.0 || sample_point.y > _NativeResolution.y || sample_point.y < 0.0) return false;

                    float4 sample_sdf      = _Sdf.SampleLevel(sampler_Sdf, sample_point * _NativeTexelSize, 0);
                    float  dist_to_surface = sample_sdf.r;

                    // we hit a surface
                    if (dist_to_surface < 0.8)
                    {
                        hit_color = sample_sdf.gba;
                        return true;
                    }

                    cur_dist += dist_to_surface;
                }

                return false;
            }

            float4 frag(v2f i) : SV_Target
            {
                float3 pixel_color = float3(0, 0, 0);

                float rand2pi = random(i.uv * float2(_Time.x, -_Time.x)) * 2.0 * PI;

                for (int ray = 0; ray < RAYS; ray++)
                {
                    float  cur_angle  = rand2pi + GOLDENANGLE * float(ray);
                    float2 ray_dir    = normalize(float2(cos(cur_angle), sin(cur_angle)));
                    float2 ray_origin = i.uv * _NativeResolution;

                    float3 hit_color;

                    bool hit = raymarch(ray_origin, ray_dir, hit_color);

                    if (hit)
                    {
                        pixel_color += hit_color;
                    }
                }

                pixel_color /= float(RAYS);

                return float4(pixel_color * EMISSIONMULT, 1.0);
            }
            ENDHLSL
        }
    }
}
```
<figcaption>GISimpleRaymarching.shader</figcaption>

</details>
<details>
<summary>Render function</summary>

```cs
using (_renderGraph.RecordAndExecute(renderGraphParams))
{
    ...
    
    // Generate SDF Pass
    ...
    
    // Generate new GI Pass
    var giData = RenderGISimpleMarchingPass(camera, 
        _renderGraph,
        basePassData.Emission,
        sdfData.SDF);
    
    // Blit base pass to screen
    ...
}
```
<figcaption>MyRenderPipeline.cs</figcaption>

</details>

### Ray Direction
```c
float random(float2 st)
{
    return frac(sin(dot(st.xy, float2(12.9898, 78.233))) * 43758.5453123);
}

float4 frag(v2f i) : SV_Target
{
    ...
    float rand2pi = random(i.uv * float2(_Time.x, -_Time.x)) * 2.0 * PI;

    for (int ray = 0; ray < RAYS; ray++)
    {
        float  cur_angle  = rand2pi + GOLDENANGLE * float(ray);
        float2 ray_dir    = normalize(float2(cos(cur_angle), sin(cur_angle)));
        ...
    }
    ...
}
```
<figcaption>Randomness in our ray construction</figcaption>

Instead of using predefined directions for our rays (as in the presentation on the top of this post) we try to randomly shoot rays towards every direction. In path tracing there are a lot of ways to choose those ray directions, here we try something that is fast and produces good looking results. If you search around [Shadertoy](https://www.shadertoy.com/), there are a lot of different formulas most of them relying on *magic numbers* to produce a result that is good enough. 

We use one of this formulas here and we call the random method with the current uv and time as an input to differentiate the results for each pixel and frame. We then use that random number as our initial ray angle, and for each of our rays we add another 2*PI/Rays angle so that we distribute our rays equally around. The result is noisy but we will check on ways to reduce that later.

### Units

```c
bool raymarch(float2 origin, float2 dir, out float3 hit_color)
{
    ...
    // early exit if we hit the edge of the screen.
    if(sample_point.x > _NativeResolution.x 
    || sample_point.x < 0.0 
    || sample_point.y > _NativeResolution.y 
    || sample_point.y< 0.0) return false;

    float4 sample_sdf      = _Sdf.SampleLevel(sampler_Sdf, sample_point * _NativeTexelSize, 0);
    ...
}
```
<figcaption>Be aware of your units</figcaption>

If you recall from our [previous post](/blog/2d-gi-series-2-generating-sdf-on-runtime/#transform-to-distance-field) when we generated the distance field we chose to encode it as pixel units instead of uv units, because it helps a lot with debugging, and it is aspect ratio agnostic. This is the reason you see that multiplication with <mark>_NativeTexelSize</mark> above to transform our pixel units to uv units.

![RenderDoc](/media/blog/2d-gi-series-3-simple-gi-raymarching/RenderDoc_01.png)
<figcaption>Using RenderDoc to debug our renderer</figcaption>

## Blitting everything to screen

Let's update our <mark>BlitToScreenPass</mark> so as to show the beautiful job we have done until this point! In our blit shader we will just multiply our albedo with the gi and <mark>aces</mark> tonemap it to bring it down to sdr. Yeah i know it's not such a sophisticated lighting model but it will do for now :P If everything is setup correctly you should have something similar to bellow!

<details><summary>Update BlitToScreen Pass</summary>

```cs
public partial class MyRenderPipeline
{
    private static Material _blitToScreenMaterial;

    class BlitToScreenPassData
    {
        public TextureHandle Albedo;
        public TextureHandle GI;
        public TextureHandle CameraTarget;
    }

    public void RenderBlitToScreenPass(RenderGraph renderGraph, TextureHandle albedo, TextureHandle gi)
    {
        if (_blitToScreenMaterial == null) _blitToScreenMaterial = CoreUtils.CreateEngineMaterial(Shader.Find("Hidden/MyPipeline/BlitToScreen"));

        using (var builder = renderGraph.AddRenderPass<BlitToScreenPassData>("BlitToScreenPass", out var passData, new ProfilingSampler("Blit to Screen profiler")))
        {
            passData.Albedo = builder.ReadTexture(albedo);
            passData.GI = builder.ReadTexture(gi);
            passData.CameraTarget = renderGraph.ImportBackbuffer(BuiltinRenderTextureType.CameraTarget);
                
            builder.SetRenderFunc((BlitToScreenPassData data, RenderGraphContext context) =>
            {
                _blitToScreenMaterial.SetTexture("_Albedo", data.Albedo);
                _blitToScreenMaterial.SetTexture("_GI", data.GI);
                context.cmd.Blit(null, data.CameraTarget, _blitToScreenMaterial);
            });
        }
    }
}
```
</details>

<details><summary>Update BlitToScreen Shader</summary>

```c
Shader "Hidden/MyPipeline/BlitToScreen"
{
    Properties {}

    SubShader
    {
        Pass
        {
            Name "BlitToScreenPass"

            // No culling or depth
            Cull Off ZWrite Off ZTest Always

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Transformations.hlsl"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 uv : TEXCOORD;
            };

            v2f vert(appdata v)
            {
                v2f o;
                o.vertex = TransformObjectToHClip(v.vertex.xyz);
                o.uv     = v.uv;
                return o;
            }

            sampler2D _Albedo;
            sampler2D _GI;

            float3 tonemap_aces(float3 color)
            {
                const float slope = 12.0;
                float4      x     = float4(
                    color.r, color.g, color.b,
                    (color.r * 0.299) + (color.g * 0.587) + (color.b * 0.114)
                );
                const float a       = 2.51f;
                const float b       = 0.03f;
                const float c       = 2.43f;
                const float d       = 0.59f;
                const float e       = 0.14f;
                float4      tonemap = clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
                float       t       = x.a;
                t                   = t * t / (slope + t);
                return lerp(tonemap.rgb, tonemap.aaa, t);
            }

            float4 frag(v2f i) : SV_Target
            {
                float3 albedo = tex2D(_Albedo, i.uv).rgb;
                float3 gi     = tex2D(_GI, i.uv).rgb;

                return float4(tonemap_aces(albedo * gi), 1.0);
            }
            ENDHLSL
        }
    }
}
```
</details>

<video src="/media/blog/2d-gi-series-3-simple-gi-raymarching/GIResult.mp4" controls loop muted playsinline></video>
<figcaption>Our current result. Native resolution: 320x180, Presentation Res: 640x360, Rays: 64</figcaption>

In future posts we will look into temporal smoothing, and make a version that implements radiance cascades instead of our current brute force approach!