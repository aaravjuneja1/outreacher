export const DISCIPLINE_GROUPS = [
  {
    label: "Computing and data",
    options: [
      "Computer science",
      "Artificial intelligence",
      "Machine learning",
      "Cybersecurity",
      "Human-computer interaction",
      "Data science",
      "Information systems",
      "Software engineering",
      "Computational linguistics",
      "Bioinformatics",
      "Robotics",
      "Game design"
    ]
  },
  {
    label: "Mathematics and science",
    options: [
      "Mathematics",
      "Statistics",
      "Applied mathematics",
      "Physics",
      "Astronomy",
      "Chemistry",
      "Biochemistry",
      "Biology",
      "Neuroscience",
      "Environmental science",
      "Marine science",
      "Geology",
      "Materials science"
    ]
  },
  {
    label: "Engineering and design",
    options: [
      "Civil engineering",
      "Mechanical engineering",
      "Electrical engineering",
      "Chemical engineering",
      "Biomedical engineering",
      "Aerospace engineering",
      "Environmental engineering",
      "Industrial engineering",
      "Architecture",
      "Urban planning",
      "Product design",
      "Transportation engineering"
    ]
  },
  {
    label: "Society, business and law",
    options: [
      "Economics",
      "Microeconomics",
      "Macroeconomics",
      "Econometrics",
      "Finance",
      "Accounting",
      "Management",
      "Marketing",
      "Entrepreneurship",
      "Political science",
      "International relations",
      "Public policy",
      "Law",
      "Criminology",
      "Sociology",
      "Anthropology",
      "Psychology",
      "Communications",
      "Journalism",
      "Education"
    ]
  },
  {
    label: "Health and humanities",
    options: [
      "Medicine",
      "Public health",
      "Nursing",
      "Pharmacy",
      "Dentistry",
      "Nutrition",
      "History",
      "Philosophy",
      "Literature",
      "Linguistics",
      "Languages",
      "Religious studies",
      "Music",
      "Fine arts",
      "Theatre and performance"
    ]
  }
] as const;

export const ALL_DISCIPLINES = DISCIPLINE_GROUPS.flatMap((group) => group.options);
