---
title: "2d GI Series #2 - Generating sdf on runtime"
description: "The second part of the 2d global illumination series covering the runtime generation of the signed distance field representation of our scene using the JFA (Jump Flood Algorithm)"
pubDate: 2024-01-26
tags: ["unity", "render pipeline", "global illumination", "jump flood", "voronoi", "sdf"]
---
## Our goals for the second part

Up until now we only have a base pass that renders our sprites on an albedo texture. We need to modify our base pass to write some more data that will come in use later. We will add an additional render target called <mark>Emission</mark>. On this emission render target we will store each pixel's emissive color on the rgb channels, and whether that pixel will be a part of the voronoi diagram generation on the alpha channel.

Later we will use that emission alpha channel to generate our <mark>voronoi diagram</mark> using the <mark>jump flood algorithm</mark>. And finally we will transform the voronoi diagram into a <mark>signed distance field</mark> of our scene.

<details>
    <summary>What is a voronoi diagram?</summary>

![Euclidean Voronoi Diagram](/media/blog/2d-gi-series-2-generating-sdf-on-runtime/Euclidean_Voronoi_diagram.svg)
A [voronoi diagram](https://en.wikipedia.org/wiki/Voronoi_diagram) in the simplest case is shown in the picture above. Starting with 20 points scattered on the plane, the voronoi diagram splits the plane into regions where each region points to the closest point. 

</details>

<details>
    <summary>What is the jump flood algorithm?</summary>

Great visual explanation and resource in this video by [Ghislain Girardot](https://www.youtube.com/watch?v=-lEeBwNdfw4) and the original paper is [here](https://www.comp.nus.edu.sg/~tants/jfa/i3d06.pdf). Another great interactive resource can be found [here](https://www.rykap.com/graphics/skew/2016/02/25/voronoi-diagrams/)

</details>

<details>
    <summary>What is a distance field and why we need one?</summary>

A distance field in its simplest form(baked in a 2d texture) is a texture where the value of each pixel is the distance to the closest object.

![Signed distance field explanation](/media/blog/2d-gi-series-2-generating-sdf-on-runtime/SDFExplanation.gif)

<figcaption>Example of a signed distance field of a circle. Notice how the values of the grid change as the ring moves around and changes it's size</figcaption>

Specifically in a signed distance field the values outside the object are positive, while the values inside the object are negative.
We will use the distance field on our next step to accelerate our raymarching shader! More details on that step..

</details>


## Adding emission rendering on base pass

<details>
<summary>Base Pass</summary>

```cs
public class BasePassData
{
    ...
    public TextureHandle Emission;
    public TextureHandle Depth;
}

public BasePassData RenderBasePass(Camera camera, RenderGraph renderGraph, CullingResultscullingResults)
{
    ...
    var emission = CreateHDRColorTexture(renderGraph, "Emission", Color.clear);
    basePassData.Emission = builder.UseColorBuffer(emission, 1);
    
    var depth = CreateDepthTexture(renderGraph);
    basePassData.Depth = builder.UseDepthBuffer(depth, DepthAccess.Write);
    ...
}
```
<figcaption>BasePass.cs</figcaption>

</details>

<details>
<summary>Sprite shader</summary>

```c
Shader "MyPipeline/Sprite"
{
    Properties
    {
        [PerRendererData] _MainTex ("MainTex (RGBA)", 2D) = "white" {}
        [PerRendererData] _WallTex ("WallTex", 2D) = "white"{}
        _Color("Main Color", Color) = (1,1,1,1)
        [HDR] _EmissionColor("Emission Color", Color) = (0,0,0,0)
    }

    SubShader
    {
        Tags
        {
            "Queue"="Transparent"
        }

        Pass
        {
            Tags
            {
                "LightMode" = "BasePass"
            }
            Blend 0 SrcAlpha OneMinusSrcAlpha
            Blend 1 SrcAlpha OneMinusSrcAlpha

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Transformations.hlsl"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
            };

            struct RTstruct
            {
                float4 Albedo : SV_Target0;
                float4 Emission : SV_Target1;
            };

            CBUFFER_START(UnityPerMaterial)
                sampler2D _MainTex;
                sampler2D _WallTex;
                float4    _Color;
                float4    _EmissionColor;
            CBUFFER_END

            v2f vert(appdata v)
            {
                v2f o;
                o.vertex = TransformObjectToHClip(v.vertex.xyz);
                o.uv     = v.uv;
                return o;
            }

            RTstruct frag(v2f i) : SV_Target
            {
                RTstruct o;

                // Albedo
                float4 color = tex2D(_MainTex, i.uv);
                o.Albedo     = color * _Color;

                // Emission
                float4 emission = _EmissionColor;
                emission.a *= tex2D(_WallTex, i.uv).r;
                o.Emission = emission;

                return o;
            }
            ENDHLSL
        }
    }
}
```
<figcaption>Sprite.shader</figcaption>

</details>

Our updated base pass code and shader is above. We utilize <mark>MRT (multiple render targets)</mark> to write at the same time to both the <mark>albedo</mark> and <mark>emission</mark> targets. We also had to add a depth buffer, since setting MRTs without a depth buffer is not supported. Notice that we added an HDR render target for emission so that we can increase our emission values to more than 1.

![Secondary Textures Setup](/media/blog/2d-gi-series-2-generating-sdf-on-runtime/SecondaryTexturesSetup.gif)
<figcaption>Secondary texture example on a tilesheet</figcaption>

On the shader code note that we use an additional texture called <mark>_WallTex</mark> to specify that <mark>alpha channel</mark> on our emission render target. We define that with the <mark>[PerRendererData]</mark> property, same as we do for the MainTex. This will allow us to use a cool unity sprite feature called [secondary textures](https://docs.unity3d.com/2023.2/Documentation/Manual/SpriteEditor-SecondaryTextures.html). <mark>Secondary textures</mark> will help with our asset creation and management pipeline, since just drag dropping a properly setup sprite on our scene and using our sprite material will auto assign both the <mark>_MainTex</mark> and <mark>_WallTex</mark> automatically. Probably i should have done the same for the emission part, but for now i just created a new material to change the emission of one of my sprites to red. Let's check our updated base pass on the frame debugger!

![MRT frame debugger](/media/blog/2d-gi-series-2-generating-sdf-on-runtime/MRTFrameDebugger.gif)
<figcaption>Checking out our multiple render target setup on the frame debugger</figcaption>


## Jump flood algorithm
<mark>Jump flood algorithm</mark> is computed in steps, where we use as input the result of the previous step. Since reading and writing to the same render target is not supported, we will use the common <mark>ping pong</mark> technique. We will create two render targets and we will flip between them setting one as input and one as output. Before moving to the ping pong passes we will use a basic setup pass to initialize the data on the first of the two render targets. 

### Setup Pass

The <mark>Jump Flood Setup Pass</mark> job is quite easy.

* Reads from the <mark>emission</mark> render target that we created in our base pass
* Generates the two render targets that we will use in our ping pong technique
* Outputs to the first of those two the uv coords of the pixel if its emission alpha value is 1

<details>
<summary>Jump flood setup pass</summary>

```cs
public partial class MyRenderPipeline
{
    private static Material _jumpFloodSetupMaterial;

    public class JumpFloodData
    {
        public TextureHandle Emission;
        public TextureHandle JumpFloodA;
        public TextureHandle JumpFloodB;
    }

    public JumpFloodData RenderJumpFloodSetupPass(Camera camera, RenderGraph renderGraph, TextureHandle emission)
    {
        if (_jumpFloodSetupMaterial == null) _jumpFloodSetupMaterial = CoreUtils.CreateEngineMaterial(Shader.Find("Hidden/MyPipeline/JumpFloodSetup"));
        
        using (var builder = renderGraph.AddRenderPass<JumpFloodData>("JumpFloodInitPass", out var passData, new ProfilingSampler("Jump Flood Setup Profiler")))
        {
            passData.Emission = builder.ReadTexture(emission);
            TextureHandle jumpFloodA = CreateHDRColorTexture(renderGraph, "JumpFloodA", Color.black, FilterMode.Point ,true);
            TextureHandle jumpFloodB = CreateHDRColorTexture(renderGraph, "JumpFloodB", Color.black, FilterMode.Point, true);
        
            passData.JumpFloodA = builder.UseColorBuffer(jumpFloodA, 0);
            passData.JumpFloodB = builder.WriteTexture(jumpFloodB);
            builder.SetRenderFunc((JumpFloodData data, RenderGraphContext context) =>
            {
                _jumpFloodSetupMaterial.SetTexture("_Emission", data.Emission);
                context.cmd.Blit(null, data.JumpFloodA, _jumpFloodSetupMaterial);
            });
            return passData;
        }
    }
}
```
<figcaption>JumpFloodSetupPass.cs</figcaption>

</details>

<details>
<summary>Jump flood setup shader</summary>

```c
Shader "Hidden/MyPipeline/JumpFloodSetup"
{
    Properties {}

    SubShader
    {
        Pass
        {
            Name "JumpFloodSetupPass"

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

            sampler2D _Emission;
            float2    _NativeResolution;

            float4 frag(v2f i) : SV_Target
            {
                float2 uv = i.uv;
                if (_NativeResolution.x > _NativeResolution.y)
                {
                    uv.y = ((uv.y - 0.5) * (_NativeResolution.x / _NativeResolution.y)) + 0.5;
                }
                else
                {
                    uv.x = ((uv.x - 0.5) * (_NativeResolution.y / _NativeResolution.x)) + 0.5;
                }

                float4 emission = tex2D(_Emission, uv);

                return float4(i.uv.x * emission.a, i.uv.y * emission.a, 0, 1);
            }
            ENDHLSL
        }
    }
}
```
<figcaption>JumpFloodSetup.shader</figcaption>

</details>

<details>
<summary>Update MyPipeline render method</summary>

```c
...

using (_renderGraph.RecordAndExecute(renderGraphParams))
{
    // Base pass
    var basePassData = RenderBasePass(camera, _renderGraph, cullResults);

    // Jump Flood
    // Setup phase. Reads emission and generates the jump flood starting data
    var jumpFloodData = RenderJumpFloodSetupPass(camera, _renderGraph, basePassData.Emission);
    
    // Blit base pass to screen
    RenderBlitToScreenPass(_renderGraph, basePassData.Albedo);
}

...

```
<figcaption>MyRenderPipeline.cs</figcaption>

</details>

<details>
    <summary>The new render targets format and size</summary>

To avoid the issue with the incorrect aspect ratio of our sdf that [Ghislain Girardot](https://youtu.be/-lEeBwNdfw4?si=Fang0gyTU6idbxFX&t=1664) encounters in his video for these render targets we use a square aspect ratio with a size of the biggest of our native resolution xy axises.

```cs
private TextureHandle CreateHDRColorTexture(RenderGraph renderGraph, string name, Color clearColor, FilterMode filterMode = FilterMode.Point, bool square = false)
{
    var width = square ? Mathf.Max(NativeResolution.x, NativeResolution.y) : NativeResolution.x;
    var height = square ? Mathf.Max(NativeResolution.x, NativeResolution.y) : NativeResolution.y;

    TextureDesc colorRTDesc = new(width, height)
    {
        name = name,
        colorFormat = GraphicsFormatUtility.GetGraphicsFormat(RenderTextureFormat.ARGBFloat, false),
        depthBufferBits = 0,
        msaaSamples = MSAASamples.None,
        enableRandomWrite = false,
        clearBuffer = true,
        clearColor = clearColor,
        discardBuffer = false,
        wrapMode = TextureWrapMode.Clamp,
        filterMode = filterMode
    };

    return renderGraph.CreateTexture(colorRTDesc);
}
```
<figcaption>The CreateHDRColorTexture method</figcaption>

Thus on our shader we need this simple transformation on our uvs to read the correct pixel on the emission render target.
```c
...
if (_NativeResolution.x > _NativeResolution.y)
{
    uv.y = ((uv.y - 0.5) * (_NativeResolution.x / _NativeResolution.y)) + 0.5;
}
else
{
    uv.x = ((uv.x - 0.5) * (_NativeResolution.y / _NativeResolution.x)) + 0.5;
}
...
```

Since we will need to store values bigger than 1.0 later on our sdf generation and for extra precision we will use hdr formats for these two render targets. And finally as everything so far we use point filtering. Here and on the sdf later it is extremely important to <mark>not have any interpolation</mark> on our values!

</details>

### Ping Pong Pass setup

We are now ready to move on to the jump flood algorithm implementation. Again if you haven't already, now is the time to check the resources on the note on the start of the article for details on the algorithm.

![Ping Pong Frame Debugger](/media/blog/2d-gi-series-2-generating-sdf-on-runtime/PingPongFrameDebugger.gif)
<figcaption>The implementation result on the frame debugger</figcaption>

![Ping Pong Render Graph](/media/blog/2d-gi-series-2-generating-sdf-on-runtime/PingPongRenderGraph.gif)
<figcaption>And the corresponding render graph visualization</figcaption>

<details>
<summary>Jump flood step pass</summary>

```cs
public partial class MyRenderPipeline
{
    private static Material[] _jumpFloodStepMaterial = new Material[0];

    public class JumpFloodStepData
    {
        public TextureHandle JumpFloodIn;
        public TextureHandle JumpFloodOut;
        public int Step;
        public float StepSize;
    }

    public void InitializeJumpFloodStepMaterials(int amount)
    {
        if (_jumpFloodStepMaterial.Length != amount) _jumpFloodStepMaterial = new Material[amount];
        for (int i = 0; i < amount; i++)
        {
            _jumpFloodStepMaterial[i] = CoreUtils.CreateEngineMaterial(Shader.Find("Hidden/MyPipeline/JumpFloodStep"));
        }
    }

    public JumpFloodStepData RenderJumpFloodStepPass(Camera camera, RenderGraph renderGraph, int step, float stepSize, TextureHandle jumpFloodIn, TextureHandle jumpFloodOut)
    {
        using (var builder = renderGraph.AddRenderPass<JumpFloodStepData>($"Jump Flood Step {step}", out var passData))
        {
            passData.JumpFloodIn = builder.ReadTexture(jumpFloodIn);
            passData.JumpFloodOut = builder.UseColorBuffer(jumpFloodOut, 0);
            passData.Step = step;
            passData.StepSize = stepSize;
            builder.SetRenderFunc((JumpFloodStepData data, RenderGraphContext context) =>
            {
                _jumpFloodStepMaterial[data.Step - 1].SetTexture("_JumpFloodIn", data.JumpFloodIn);
                _jumpFloodStepMaterial[data.Step - 1].SetFloat("_StepIn", data.StepSize);
                
                context.cmd.Blit(null, data.JumpFloodOut, _jumpFloodStepMaterial[data.Step - 1]);
            });
            return passData;
        }
    }
}
```
<figcaption>JumpFloodStepPass.cs</figcaption>

</details>

<details>
<summary>Jump flood step shader</summary>

```c
Shader "Hidden/MyPipeline/JumpFloodStep"
{
    Properties {}

    SubShader
    {
        Pass
        {
            Name "JumpFloodStepPass"

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

            Texture2D    _JumpFloodIn;
            SamplerState sampler_JumpFloodIn;
            float        _StepIn;
            float2       _NativeSquareResolution;
            float2       _NativeSquareTexelSize;

            static const float2 UVOffsets[9] = {float2(1, 0), float2(-1, 0), float2(0, 1), float2(0, -1), float2(0, 0), float2(1, 1), float2(1, -1), float2(-1, 1), float2(-1, -1)};

            float4 frag(v2f i) : SV_Target
            {
                const float  step_size = max(1.0, _StepIn);
                const float2 uv        = ((floor(i.uv * _NativeSquareResolution) + 0.5) / _NativeSquareResolution);

                float4 best_sample   = float4(0.0, 0.0, 0.0, 0.0);
                float  best_distance = 10000000;

                for (int y = 0; y < 9; y++)
                {
                    float2       grid_uv = uv + UVOffsets[y] * step_size * _NativeSquareTexelSize;
                    const float4 sample  = _JumpFloodIn.SampleLevel(sampler_JumpFloodIn, grid_uv, 0);

                    if (sample.x == 0.0 && sample.y == 0.0) continue;

                    const float distance = length(sample.xy - uv);
                    if (distance < best_distance)
                    {
                        best_distance = distance;
                        best_sample   = sample;
                    }
                }

                return best_sample;
            }
            ENDHLSL
        }
    }
}
```
<figcaption>JumpFloodStep.shader</figcaption>

</details>

<details>
<summary>Update MyPipeline render method</summary>

```cs
...

using (_renderGraph.RecordAndExecute(renderGraphParams))
{
    // Base pass
    var basePassData = RenderBasePass(camera, _renderGraph, cullResults);

    // Jump Flood
    // Setup phase. Reads emission and generates the jump flood starting data
    var jumpFloodData = RenderJumpFloodSetupPass(camera, _renderGraph, basePassData.Emission);

    // Calculate number of steps required
    var steps = Mathf.CeilToInt(Mathf.Log(Mathf.Max(NativeResolution.x, NativeResolution.y)) / Mathf.Log(2.0f));
    InitializeJumpFloodStepMaterials(steps);

    // For each step ping pong textures and setup settings
    for (int i = 1; i <= steps; i++)
    {
        // Real step size in Pixels
        var stepSize = Mathf.Pow(2, steps - i);   
        //Ping pong textureA and textureB
        if (i % 2 == 0)
        {
            RenderJumpFloodStepPass(camera, _renderGraph, i, stepSize, jumpFloodData.JumpFloodB, jumpFloodData.JumpFloodA);
        }
        else
        {
            RenderJumpFloodStepPass(camera, _renderGraph, i, stepSize, jumpFloodData.JumpFloodA, jumpFloodData.JumpFloodB);
        }
    }
    
    // Blit base pass to screen
    RenderBlitToScreenPass(_renderGraph, basePassData.Albedo);
}

...

```
<figcaption>MyRenderPipeline.cs</figcaption>

</details>

Some things to note here are:
* The use of a material array (one material per step pass) on <mark>JumpFloodStepPass.cs</mark> 
* The use of _JumpFloodIn.SampleLevel() on <mark>JumpFloodStep.shader</mark> instead of the usual tex2D() because we are inside a loop and we want to specifically sample the first mipmap level

## Transform to Distance Field

Time for our last step in this part, the distance field generation. The workflow should feel familiar by now:
* Partial class of our new pass with its data class
* Corresponding shader
* Call our pass render method from our render pipeline render method

The <mark>SDF pass</mark> will read the result of our <mark>JumpFlood</mark> algorithm above and the <mark>emission</mark> render target and pack in a new render target the <mark>DistanceField in pixel units(R) and emission(GBA)</mark>! The new <mark>SDF render target</mark>
will have have the same size as our <mark>Native resolution</mark> so we will again need a uv transformation to read the correct pixel from our <mark>Jump Flood</mark> square render target.

Finally send the <mark>SDF render target</mark> to our <mark>blit to screen pass</mark> instead of the <mark>albedo</mark> to force the render graph to render our new passes!

<details>
<summary>Generate Sdf pass</summary>

```cs
using UnityEngine;
using UnityEngine.Experimental.Rendering.RenderGraphModule;
using UnityEngine.Rendering;

namespace Pipeline
{
    public partial class MyRenderPipeline
    {
        private static Material _generateSDFMaterial;

        public class GenerateSDFData
        {
            public TextureHandle Emission;
            public TextureHandle JumpFlood;
            public TextureHandle SDF;
        }

        public GenerateSDFData RenderGenerateSDFPass(Camera camera, RenderGraph renderGraph, TextureHandle jumpFlood, TextureHandle emission)
        {
            if (_generateSDFMaterial == null) _generateSDFMaterial = CoreUtils.CreateEngineMaterial(Shader.Find("Hidden/MyPipeline/GenerateSDF"));

            using (var builder = renderGraph.AddRenderPass<GenerateSDFData>("GenerateSDFPass", out var passData, new ProfilingSampler("Generate SDF profiler")))
            {
                passData.Emission = builder.ReadTexture(emission);
                passData.JumpFlood = builder.ReadTexture(jumpFlood);
                var sdf = CreateHDRColorTexture(renderGraph, "SDF", Color.black);
                passData.SDF = builder.UseColorBuffer(sdf, 0);

                builder.SetRenderFunc((GenerateSDFData data, RenderGraphContext context) =>
                {
                    _generateSDFMaterial.SetTexture("_Emission", data.Emission);
                    _generateSDFMaterial.SetTexture("_JumpFlood", data.JumpFlood);
                    context.cmd.Blit(null, data.SDF, _generateSDFMaterial);
                });

                return passData;
            }
        }
    }
}

```
<figcaption>GenerateSDFPass.cs</figcaption>

</details>

<details>
<summary>Generate Sdf shader</summary>

```c
Shader "Hidden/MyPipeline/GenerateSDF"
{
    Properties {}

    SubShader
    {
        Pass
        {
            Name "GenerateSDFPass"

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

            sampler2D _JumpFlood;
            sampler2D _Emission;
            float2    _NativeResolution;

            float4 frag(v2f i) : SV_Target
            {
                float2 uv = i.uv;

                if (_NativeResolution.x > _NativeResolution.y)
                {
                    uv.y = (uv.y - 0.5) * (_NativeResolution.y / _NativeResolution.x) + 0.5 ;
                }
                else if (_NativeResolution.x < _NativeResolution.y)
                {
                    uv.x = (uv.x - 0.5) * (_NativeResolution.x / _NativeResolution.y) + 0.5;
                }

                float2 currentValue = uv;
                float2 jumpValue    = tex2D(_JumpFlood, uv).xy;
                float3 emission     = tex2D(_Emission, i.uv).rgb;
                
                float distX = currentValue.x - jumpValue.x;
                float distY = currentValue.y - jumpValue.y;

                if (_NativeResolution.x > _NativeResolution.y)
                {
                    distX *= _NativeResolution.x;
                    distY *= _NativeResolution.x;
                }
                else 
                {
                    distX *= _NativeResolution.y;
                    distY *= _NativeResolution.y;
                }

                const float distance = sqrt(pow(distX, 2) + pow(distY, 2));
            
                return float4(distance, emission);
            }
            ENDHLSL
        }
    }
}
```
<figcaption>GenerateSDF.shader</figcaption>

</details>

<details>
<summary>Update MyPipeline render method</summary>

```cs
...

// Generate SDF Pass
var sdfData = RenderGenerateSDFPass(camera, 
    _renderGraph,
    (steps % 2 == 0) ? jumpFloodData.JumpFloodA : jumpFloodData.JumpFloodB,
    basePassData.Emission);

// Blit base pass to screen
RenderBlitToScreenPass(_renderGraph, sdfData.SDF);

...
```

<figcaption>MyRenderPipeline.cs</figcaption>

</details>

![SDF Frame Debugger](/media/blog/2d-gi-series-2-generating-sdf-on-runtime/SDFFrameDebugger.gif)
<figcaption>All our passes in the frame debugger</figcaption>

Notice when viewing the <mark>SDF pass</mark> on the frame debugger that in order to properly display it we need to change the max limit of our levels bar to a much bigger value than 1.0 since the distance field is encoded in pixel units!
That's it for this part! We have a custom pipeline that can generate a distance field representation of our unity sprites! In the next part we will use that distance field to speed up our raymarching and finally create some beautiful images 😊