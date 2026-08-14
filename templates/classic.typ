// ImprintCV Template: Classic ("Harvard / Ivy League" Executive)
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
  set document(title: name + " - Curriculum Vitae", author: name)
  set page(
    paper: "us-letter",
    margin: (x: margin, y: margin),
  )
  set text(
    font: ("Linux Libertine", "Times New Roman", "DejaVu Serif"),
    size: fontSize,
    fill: rgb("#000000"),
    lang: "en",
  )
  set par(justify: true, leading: 0.6em)

  // Centered Header
  align(center)[
    #text(size: 1.8em, weight: "bold", tracking: 0.05em)[#smallcaps(name)] \
    #v(3pt)
    #text(size: 0.9em)[
      #let contacts = ()
      #if location != none { contacts.push(location) }
      #if phone != none { contacts.push(phone) }
      #if email != "" { contacts.push(email) }
      #if linkedin != none { contacts.push(linkedin) }
      #if website != none { contacts.push(website) }
      #contacts.join(" | ")
    ]
  ]

  #v(spacing)

  // Section Macro
  let section(title) = {
    v(spacing)
    align(center)[
      #text(size: 1.1em, weight: "bold")[#smallcaps(title)]
    ]
    v(-4pt)
    line(length: 100%, stroke: 0.5pt + rgb("#000000"))
    v(2pt)
  }

  // Summary
  if summary != none and summary != "" {
    section("Professional Summary")
    text(size: 0.95em)[#summary]
  }

  // Experience
  if experience.len() > 0 {
    section("Professional Experience")
    for exp in experience [
      #grid(
        columns: (1fr, auto),
        text(weight: "bold")[#exp.company],
        text(weight: "bold")[#exp.startDate -- #if exp.endDate != none { exp.endDate } else { "Present" }]
      )
      #grid(
        columns: (1fr, auto),
        text(style: "italic")[#exp.title],
        text(style: "italic")[#if "location" in exp and exp.location != none { exp.location } else { "" }]
      )
      #v(2pt)
      #for b in exp.bullets [
        #list(marker: [•], text(size: 0.95em)[#b.tailored])
      ]
      #v(3pt)
    ]
  }

  // Education
  if education.len() > 0 {
    section("Education")
    for edu in education [
      #grid(
        columns: (1fr, auto),
        text(weight: "bold")[#edu.institution],
        text(weight: "bold")[#if "startDate" in edu and edu.startDate != none { edu.startDate + " -- " } else { "" }#if "endDate" in edu and edu.endDate != none { edu.endDate } else { "" }]
      )
      #text(style: "italic")[#edu.degree#if "field" in edu and edu.field != none { " in " + edu.field } else { "" }]
      #v(2pt)
    ]
  }

  // Skills
  if skills.len() > 0 {
    section("Areas of Expertise")
    let skillNames = skills.map(s => s.name).join(", ")
    text(size: 0.95em)[#strong("Core Competencies: ") #skillNames]
    v(spacing)
  }

  // Projects
  if projects.len() > 0 {
    section("Selected Projects")
    for proj in projects [
      #text(weight: "bold")[#proj.name] \
      #text(size: 0.95em)[#proj.description]
      #for h in proj.highlights [
        #list(marker: [•], text(size: 0.95em)[#h])
      ]
      #v(2pt)
    ]
  }

  body
}
