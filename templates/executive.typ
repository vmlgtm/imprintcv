// ImprintCV Template: Executive (Leadership / Staff / Principal Roles)
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
  set document(title: name + " - Executive Resume", author: name)
  set page(
    paper: "us-letter",
    margin: (x: margin, y: margin),
  )
  set text(
    font: ("Linux Libertine", "Times New Roman", "DejaVu Serif", "Georgia", "Serif"),
    size: fontSize,
    fill: rgb("#0f172a"),
    lang: "en",
  )
  set par(justify: false, leading: 0.58em)

  // Header
  align(center)[
    #text(size: 1.9em, weight: "bold", fill: rgb("#0f172a"))[#name] \
    #v(2pt)
    #text(size: 0.88em, fill: rgb("#334155"))[
      #let contacts = ()
      #if location != none { contacts.push(location) }
      #if phone != none { contacts.push(phone) }
      #if email != "" { contacts.push(email) }
      #if linkedin != none { contacts.push(linkedin) }
      #if github != none { contacts.push(github) }
      #if website != none { contacts.push(website) }
      #contacts.join("  •  ")
    ]
  ]

  #v(spacing)

  // Section Macro
  let section(title) = {
    v(spacing)
    text(size: 1.05em, weight: "bold", fill: rgb("#0f172a"))[#upper(title)]
    v(-4pt)
    line(length: 100%, stroke: 0.75pt + rgb("#475569"))
    v(2pt)
  }

  // Executive Profile
  if summary != none and summary != "" {
    section("Executive Profile & Core Competencies")
    text(size: 0.95em, style: "italic")[#summary]
  }

  // Experience
  if experience.len() > 0 {
    section("Executive Experience & Key Impact")
    for exp in experience [
      #grid(
        columns: (1fr, auto),
        text(weight: "bold", size: 1.02em)[#exp.title],
        text(fill: rgb("#334155"))[#exp.startDate -- #if exp.endDate != none { exp.endDate } else { "Present" }]
      )
      #grid(
        columns: (1fr, auto),
        text(style: "italic", fill: rgb("#1e293b"))[#exp.company],
        text(fill: rgb("#64748b"), size: 0.9em)[#if "location" in exp and exp.location != none { exp.location } else { "" }]
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
    section("Strategic & Technical Expertise")
    let skillNames = skills.map(s => s.name).join("  |  ")
    text(size: 0.95em)[#strong("Core Domains: ") #skillNames]
    v(spacing)
  }

  // Education
  if education.len() > 0 {
    section("Education & Credentials")
    for edu in education [
      #grid(
        columns: (1fr, auto),
        text(weight: "bold")[#edu.institution],
        text(fill: rgb("#334155"))[#if "startDate" in edu and edu.startDate != none { edu.startDate + " -- " } else { "" }#if "endDate" in edu and edu.endDate != none { edu.endDate } else { "" }]
      )
      #text(style: "italic", fill: rgb("#1e293b"))[#edu.degree#if "field" in edu and edu.field != none { " in " + edu.field } else { "" }]
      #v(2pt)
    ]
  }

  // Projects
  if projects.len() > 0 {
    section("Key Initiatives & Architecture")
    for proj in projects [
      #text(weight: "bold")[#proj.name] #if "url" in proj and proj.url != none [ (#proj.url) ]
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
