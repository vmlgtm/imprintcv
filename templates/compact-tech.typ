// ImprintCV Template: Compact Tech (High-Density Engineering & Architecture)
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
  margin: 0.4in,
  fontSize: 9.8pt,
  spacing: 0.45em,
  body
) = {
  set document(title: name + " - Tech Resume", author: name)
  set page(
    paper: "us-letter",
    margin: (x: margin, y: margin),
  )
  set text(
    font: ("Inter", "Helvetica", "Arial", "Liberation Sans", "DejaVu Sans"),
    size: fontSize,
    fill: rgb("#090d16"),
    lang: "en",
  )
  set par(justify: false, leading: 0.48em)

  // Header
  grid(
    columns: (1fr, auto),
    text(size: 1.6em, weight: "bold", fill: rgb("#090d16"))[#name],
    align(right)[
      #set text(size: 0.82em, fill: rgb("#374151"))
      #let contacts = ()
      #if location != none { contacts.push(location) }
      #if phone != none { contacts.push(phone) }
      #if email != "" { contacts.push(email) }
      #if github != none { contacts.push(github) }
      #if linkedin != none { contacts.push(linkedin) }
      #contacts.join(" | ")
    ]
  )

  #v(spacing * 0.75)

  // Section Macro
  let section(title) = {
    v(spacing)
    text(size: 1.02em, weight: "bold", fill: rgb("#090d16"))[#upper(title)]
    v(-4pt)
    line(length: 100%, stroke: 0.75pt + rgb("#2563eb"))
    v(2pt)
  }

  // Skills
  if skills.len() > 0 {
    section("Technical Skills")
    let skillNames = skills.map(s => s.name).join(", ")
    text(size: 0.92em)[#strong("Languages & Frameworks: ") #skillNames]
    v(spacing * 0.5)
  }

  // Experience
  if experience.len() > 0 {
    section("Work Experience")
    for exp in experience [
      #grid(
        columns: (1fr, auto),
        text(weight: "bold")[#exp.title],
        text(fill: rgb("#4b5563"), size: 0.88em)[#exp.startDate -- #if exp.endDate != none { exp.endDate } else { "Present" }]
      )
      #grid(
        columns: (1fr, auto),
        text(style: "italic", fill: rgb("#2563eb"), size: 0.92em)[#exp.company],
        text(fill: rgb("#6b7280"), size: 0.85em)[#if "location" in exp and exp.location != none { exp.location } else { "" }]
      )
      #v(1.5pt)
      #for b in exp.bullets [
        #list(marker: [•], text(size: 0.92em)[#b.tailored])
      ]
      #v(2pt)
    ]
  }

  // Projects
  if projects.len() > 0 {
    section("Key Engineering Projects")
    for proj in projects [
      #text(weight: "bold")[#proj.name] #if "url" in proj and proj.url != none [ (#text(fill: rgb("#2563eb"))[#proj.url]) ]
      #v(1pt)
      #text(size: 0.92em)[#proj.description]
      #for h in proj.highlights [
        #list(marker: [•], text(size: 0.92em)[#h])
      ]
      #v(2pt)
    ]
  }

  // Education
  if education.len() > 0 {
    section("Education")
    for edu in education [
      #grid(
        columns: (1fr, auto),
        text(weight: "bold")[#edu.institution],
        text(fill: rgb("#4b5563"), size: 0.88em)[#if "startDate" in edu and edu.startDate != none { edu.startDate + " -- " } else { "" }#if "endDate" in edu and edu.endDate != none { edu.endDate } else { "" }]
      )
      #text(style: "italic", fill: rgb("#374151"), size: 0.92em)[#edu.degree#if "field" in edu and edu.field != none { " in " + edu.field } else { "" }]
      #v(1.5pt)
    ]
  }

  body
}
