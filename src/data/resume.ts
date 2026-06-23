// ============================================================
// Single source of truth for the résumé / CV.
// Edit this file to update BOTH the About page sections AND the
// downloadable CV (regenerated on `npm run cv` / publish).
// ============================================================

export interface ResumeProject {
  name: string;
  url?: string;
  bullets: string[];
}

export interface ResumeJob {
  company: string;
  url?: string;
  location?: string;
  role: string;
  period: string;
  summary?: string;
  bullets?: string[];
  projects?: ResumeProject[];
}

export interface ResumeEducation {
  degree: string;
  school: string;
  location?: string;
  period: string;
  bullets?: string[];
}

export interface ResumeSkillGroup {
  label: string;
  value: string;
}

export const PERSONAL = {
  name: "Konstantinos Mourelas",
  title: "Technical Artist · Game Developer",
  summary:
    "Technical artist and gameplay programmer with over a decade shipping games, AR/VR and real-time graphics. I specialize in rendering pipelines, shaders, VFX and lighting — and I'm equally at home building gameplay systems, tools and UI. I like owning the visual side of a project end-to-end and bridging the gap between art and engineering.",
  location: "Patras, Greece",
  email: "mourelask@gmail.com",
  website: "mourelask.github.io",
  // Phone is intentionally omitted from the public site/CV. Add it here if you
  // want it on the downloadable CV — but note the /cv page is public.
  // phone: "+30 ...",
};

export const EXPERIENCE: ResumeJob[] = [
  {
    company: "Terahard",
    url: "https://terahard.org/",
    role: "Technical Artist & Programmer",
    period: "2024 – Present",
    summary:
      "Owning the visual pipeline across two upcoming titles while contributing to core architecture, gameplay and UI.",
    projects: [
      {
        name: "Dunebound Tactics",
        url: "https://store.steampowered.com/app/3034660/Dunebound_Tactics/",
        bullets: [
          "Built and own the graphics pipeline — custom shaders, VFX, lighting and post-processing",
          "Contributed gameplay systems and UI features",
        ],
      },
      {
        name: "RuneSmith",
        url: "https://store.steampowered.com/app/3716320/RuneSmith/",
        bullets: [
          "Established the project's core architecture — character controllers, interaction systems and UI",
          "Led visual development, including shaders and a custom outline-renderer feature",
        ],
      },
    ],
  },
  {
    company: "eNVy softworks",
    url: "https://envysoftworks.com/",
    location: "Patras, Greece",
    role: "Technical Art Director",
    period: "2018 – 2024",
    summary:
      "Co-owner (30%) of the award-winning studio, leading both art and technical direction across a wide range of projects. Highlights from those years:",
    bullets: [
      "Over 50 projects for 30+ clients in interactive media on mobile, desktop and web — mainly augmented and virtual reality",
      "20 exhibitions and conventions",
      "8 competitions and countless workshops, game jams and prototypes",
      "Two games featured at the Gamescom Indie Arena Booth",
      "A game shipped live on Steam",
    ],
    projects: [
      {
        name: "Basements 'n' Basilisks",
        url: "https://store.steampowered.com/app/2236860/Basements_n_Basilisks_Storms_of_Sorcery/",
        bullets: [
          "Gameplay programming lead",
          "UI design and implementation",
          "3D and technical art lead",
        ],
      },
      {
        name: "Dimday Red",
        url: "https://www.youtube.com/watch?v=4XvFOK4D2Ik",
        bullets: ["Technical art and optimization lead", "UI programming"],
      },
      {
        name: "Respace Twin",
        url: "https://respace.ai/respace-twin/",
        bullets: [
          "Led development of the Unity mobile app",
          "Custom partitioning system streaming BIM data from the cloud at runtime",
        ],
      },
      {
        name: "Ariel AI",
        bullets: [
          "Led a Unity mobile app showcasing ArielAI machine-learning models on humanoid rigs in real time, in AR and networked scenarios",
        ],
      },
    ],
  },
  {
    company: "Realiscape",
    url: "https://realiscape.ch/",
    location: "Patras, Greece",
    role: "Lead Unity Developer",
    period: "2016 – 2018",
    bullets: [
      "Led design and development, from the ground up, of a VR Cave firearms simulation",
      "In charge of product design and visualization",
      "Introduced and led the team's asset creation through photogrammetry",
    ],
  },
  {
    company: "HYPERCO",
    location: "Ioannina, Greece",
    role: "Lead VR Developer",
    period: "2013 – 2015",
    bullets: [
      "Developed stereoscopic 3D applications (visual tour and educational mini-games) for the Perama Cave media center",
      "Post-production of 3D models created by laser-scanning parts of Perama Cave",
      "Produced a stereoscopic 3D short documentary, directed and rendered inside Unity",
    ],
  },
  {
    company: "TigerX",
    url: "https://www.tigerx.com/",
    location: "Cornwall, UK",
    role: "Senior 3D Visualization Artist",
    period: "2012 – 2013",
    bullets: [
      "Photorealistic visualization for architectural visualization and advertising",
      "Workflow improvements via custom 3ds Max tools (MAXScript)",
    ],
  },
  {
    company: "Freelance",
    location: "Patras, Greece",
    role: "3D Generalist",
    period: "2010 – 2016",
    bullets: ["Architectural visualization", "Product design"],
  },
];

export const EDUCATION: ResumeEducation[] = [
  {
    degree: "Electrical and Computer Engineering",
    school: "University of Patras",
    location: "Greece",
    period: "2003",
    bullets: ["Master Thesis: Unbiased 3D Rendering for Photorealism"],
  },
];

export const SKILLS: ResumeSkillGroup[] = [
  {
    label: "Software",
    value:
      "Unity, 3ds Max, Blender, Substance Designer, Substance Painter, Photoshop",
  },
  {
    label: "Technical",
    value:
      "Shader creation, GPU pipeline setup, graphics optimization, workflow tool design, software architecture, gameplay programming, full asset pipeline (modeling, baking, texturing, in-engine setup & optimization)",
  },
  { label: "Programming", value: "C#, C, GLSL, HLSL" },
  { label: "Languages", value: "English (fluent), Greek (fluent)" },
  {
    label: "Interests",
    value:
      "Building & modding custom 3D printers (Voron), engine programming, mentoring artists and devs, and sci-fi/fantasy novels",
  },
];
