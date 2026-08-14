// ImprintCV Template: Modern ("Jake's Resume" / Silicon Valley Standard)
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
  set document(title: name + " - Resume", author: name)
  set page(
    paper: "us-letter",
    margin: (x: margin, y: margin),
  )
  set text(
    font: ("Inter", "Helvetica", "Arial", "Liberation Sans"),
    size: fontSize,
    fill: rgb("#111827"),
    lang: "en",
  )
  set par(justify: false, leading: 0.55em)

  // Header
  align(center)[
    #text(size: 1.75em, weight: "bold")[#name] \
    #v(2pt)
    #text(size: 0.85em, fill: rgb("#4b5563"))[
      #let contacts = ()
      #if email != "" { contacts.push(email) }
      #if phone != none { contacts.push(phone) }
      #if location != none { contacts.push(location) }
      #if website != none { contacts.push(website) }
      #if linkedin != none { contacts.push(linkedin) }
      #if github != none { contacts.push(github) }
      #contacts.join(" | ")
    ]
  ]

  #v(spacing)

  // Section Macro
  let section(title) = {
    v(spacing)
    text(size: 1.05em, weight: "bold", fill: rgb("#111827"))[#upper(title)]
    v(-4pt)
    line(length: 100%, stroke: 0.75pt + rgb("#d1d5db"))
    v(2pt)
  }

  // Summary
  if summary != none and summary != "" {
    section("Summary")
    text(size: 0.95em)[#summary]
  }

  // Experience
  if experience.len() > 0 {
    section("Experience")
    for exp in experience [
      #grid(
        columns: (1fr, auto),
        text(weight: "bold")[#exp.title],
        text(fill: rgb("#4b5563"))[#exp.startDate -- #if exp.endDate != none { exp.endDate } else { "Present" }]
      )
      #grid(
        columns: (1fr, auto),
        text(style: "italic", fill: rgb("#374151"))[#exp.company],
        text(fill: rgb("#6b7280"), size: 0.9em)[#if "location" in exp and exp.location != none { exp.location } else { "" }]
      )
      #v(2pt)
      #for b in exp.bullets [
        #list(marker: [•], text(size: 0.95em)[#b.tailored])
      ]
      #v(3pt)
    ]
  }

  // Skills
  if skills.len() > 0 {
    section("Skills")
    let skillNames = skills.map(s => s.name).join(", ")
    text(size: 0.95em)[#strong("Technical Skills: ") #skillNames]
    v(spacing)
  }

  // Education
  if education.len() > 0 {
    section("Education")
    for edu in education [
      #grid(
        columns: (1fr, auto),
        text(weight: "bold")[#edu.institution],
        text(fill: rgb("#4b5563"))[#if "startDate" in edu and edu.startDate != none { edu.startDate + " -- " } else { "" }#if "endDate" in edu and edu.endDate != none { edu.endDate } else { "" }]
      )
      #text(style: "italic", fill: rgb("#374151"))[#edu.degree#if "field" in edu and edu.field != none { " in " + edu.field } else { "" }]
      #v(2pt)
    ]
  }

  // Projects
  if projects.len() > 0 {
    section("Projects")
    for proj in projects [
      #text(weight: "bold")[#proj.name] #if "url" in proj and proj.url != none [ (#text(fill: rgb("#2563eb"))[#proj.url]) ]
      #v(1pt)
      #text(size: 0.95em)[#proj.description]
      #for h in proj.highlights [
        #list(marker: [•], text(size: 0.95em)[#h])
      ]
      #v(2pt)
    ]
  }

  body
}
