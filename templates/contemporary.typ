// ImprintCV Template: Contemporary ("Awesome-CV" Modernist with Slate Accent)
#let resume(
  name: "",
  email: "",
  phone: none,
  location: none,
  website: none,
  linkedin: none,
  github: none,
  summary: none,
  experience: (),
  skills: (),
  education: (),
  projects: (),
  margin: 0.5in,
  fontSize: 10pt,
  spacing: 0.65em,
  body
) = {
  let primaryColor = rgb("#1e293b")
  let accentColor = rgb("#3b82f6")

  set document(title: name + " - Resume", author: name)
  set page(
    paper: "us-letter",
    margin: (x: margin, y: margin),
  )
  set text(
    font: ("Inter", "Roboto", "Helvetica Neue", "Arial"),
    size: fontSize,
    fill: rgb("#1e293b"),
    lang: "en",
  )
  set par(justify: false, leading: 0.55em)

  // Header
  grid(
    columns: (1fr, auto),
    [
      #text(size: 2em, weight: "bold", fill: primaryColor)[#name] \
      #if summary != none [
        #v(1pt)
        #text(size: 0.9em, fill: rgb("#64748b"))[#summary]
      ]
    ],
    align(right)[
      #set text(size: 0.85em, fill: rgb("#475569"))
      #if email != "" [ #email \ ]
      #if phone != none [ #phone \ ]
      #if location != none [ #location \ ]
      #if linkedin != none [ #linkedin \ ]
      #if github != none [ #github ]
    ]
  )

  #v(spacing)

  // Section Macro
  let section(title) = {
    v(spacing)
    text(size: 1.1em, weight: "bold", fill: primaryColor)[#title]
    v(-4pt)
    line(length: 100%, stroke: 1pt + accentColor)
    v(2pt)
  }

  // Experience
  if experience.len() > 0 {
    section("Work Experience")
    for exp in experience [
      #grid(
        columns: (1fr, auto),
        [
          #text(weight: "bold", fill: primaryColor)[#exp.title] -- #text(fill: accentColor, weight: "medium")[#exp.company]
        ],
        text(fill: rgb("#64748b"), size: 0.9em)[#exp.startDate -- #if exp.endDate != none { exp.endDate } else { "Present" }]
      )
      #v(2pt)
      #for b in exp.bullets [
        #list(marker: [▹], text(size: 0.95em)[#b.tailored])
      ]
      #v(3pt)
    ]
  }

  // Skills
  if skills.len() > 0 {
    section("Skills & Technologies")
    let skillNames = skills.map(s => s.name).join(" • ")
    text(size: 0.95em)[#skillNames]
    v(spacing)
  }

  // Education
  if education.len() > 0 {
    section("Education")
    for edu in education [
      #grid(
        columns: (1fr, auto),
        [
          #text(weight: "bold", fill: primaryColor)[#edu.degree] \
          #text(fill: rgb("#475569"))[#edu.institution#if "location" in edu and edu.location != none { ", " + edu.location } else { "" }]
        ],
        text(fill: rgb("#64748b"), size: 0.9em)[#if "startDate" in edu and edu.startDate != none { edu.startDate + " -- " } else { "" }#if "endDate" in edu and edu.endDate != none { edu.endDate } else { "" }]
      )
      #v(2pt)
    ]
  }

  // Projects
  if projects.len() > 0 {
    section("Featured Projects")
    for proj in projects [
      #grid(
        columns: (1fr, auto),
        text(weight: "bold", fill: primaryColor)[#proj.name],
        text(fill: rgb("#64748b"), size: 0.85em)[#if "technologies" in proj { proj.technologies.join(", ") } else { "" }]
      )
      #text(size: 0.95em)[#proj.description]
      #for h in proj.highlights [
        #list(marker: [▹], text(size: 0.95em)[#h])
      ]
      #v(2pt)
    ]
  }

  body
}
