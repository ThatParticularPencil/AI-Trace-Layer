import type { TrustedDocument } from "@/app/lib/types";

export const medicalDocuments: TrustedDocument[] = [
  {
    id: "fda-warfarin-bleeding",
    source: "FDA",
    title: "Warfarin Medication Guide: Bleeding Risk",
    content:
      "Warfarin can cause major or fatal bleeding. The risk of bleeding is increased by medicines that affect clotting, including aspirin and nonsteroidal anti-inflammatory drugs such as ibuprofen and naproxen. Patients should ask a healthcare professional before taking new medicines with warfarin."
  },
  {
    id: "nih-anticoagulants",
    source: "NIH",
    title: "MedlinePlus: Warfarin Precautions",
    content:
      "People taking warfarin should tell clinicians about all prescription drugs, over-the-counter medicines, vitamins, and supplements. Changes can affect the international normalized ratio and bleeding risk."
  },
  {
    id: "mayo-ibuprofen",
    source: "Mayo Clinic",
    title: "Ibuprofen Safety Considerations",
    content:
      "Ibuprofen may increase the risk of bleeding, stomach ulcers, and kidney problems in some people. People taking blood thinners should seek medical advice before using ibuprofen or other NSAIDs."
  },
  {
    id: "nih-acetaminophen",
    source: "NIH",
    title: "MedlinePlus: Acetaminophen Overview",
    content:
      "Acetaminophen is used for pain and fever but can cause liver injury at high doses or when combined with alcohol. People using warfarin should ask a clinician before regular acetaminophen use because INR may be affected."
  },
  {
    id: "fda-antibiotics",
    source: "FDA",
    title: "Drug Interactions and Antibiotics",
    content:
      "Some antibiotics can interact with anticoagulants and other medicines. Patients should contact a healthcare professional before combining medicines when interaction risk is known or suspected."
  },
  {
    id: "mayo-chest-pain",
    source: "Mayo Clinic",
    title: "Chest Pain Emergency Guidance",
    content:
      "Chest pain, pressure, shortness of breath, sweating, nausea, or pain spreading to the arm or jaw can be symptoms of a medical emergency. Emergency care should be sought promptly for possible heart attack symptoms."
  },
  {
    id: "nih-diabetes",
    source: "NIH",
    title: "Diabetes Medication Safety",
    content:
      "Insulin and diabetes medicines require individualized dosing and monitoring. Patients should not change prescribed doses without guidance from a qualified healthcare professional."
  },
  {
    id: "fda-pregnancy-meds",
    source: "FDA",
    title: "Medicine Use During Pregnancy",
    content:
      "Pregnant patients should discuss prescription and over-the-counter medicine use with a healthcare professional because risks and benefits depend on the medicine, dose, timing, and patient-specific factors."
  },
  {
    id: "nih-hypertension",
    source: "NIH",
    title: "High Blood Pressure Treatment Basics",
    content:
      "Blood pressure treatment may include lifestyle changes and medication. Medication choices and targets depend on age, other conditions, and clinician assessment."
  },
  {
    id: "mayo-ssri",
    source: "Mayo Clinic",
    title: "SSRI Antidepressant Precautions",
    content:
      "Selective serotonin reuptake inhibitors can interact with other drugs and may increase bleeding risk when combined with NSAIDs or anticoagulants. Medication changes should be supervised."
  },
  {
    id: "nih-stroke",
    source: "NIH",
    title: "Stroke Warning Signs",
    content:
      "Sudden face drooping, arm weakness, speech difficulty, severe headache, confusion, or vision problems can be signs of stroke. Immediate emergency response is important."
  },
  {
    id: "fda-opioids",
    source: "FDA",
    title: "Opioid Pain Medicine Safety",
    content:
      "Opioids can cause serious breathing problems, sedation, dependence, and overdose. They should be taken only as prescribed and not combined with alcohol or sedatives unless directed by a clinician."
  },
  {
    id: "nih-allergy",
    source: "NIH",
    title: "Severe Allergic Reaction",
    content:
      "Trouble breathing, swelling of the lips or throat, dizziness, or widespread hives after exposure to an allergen can indicate anaphylaxis and requires emergency treatment."
  },
  {
    id: "mayo-antibiotic-resistance",
    source: "Mayo Clinic",
    title: "Antibiotic Use and Resistance",
    content:
      "Antibiotics do not treat viral infections such as colds or flu. Inappropriate antibiotic use can contribute to resistance and side effects."
  },
  {
    id: "nih-vaccines",
    source: "NIH",
    title: "Vaccines and Immune Protection",
    content:
      "Vaccines help the immune system recognize infectious diseases. Recommendations vary by age, condition, pregnancy status, and immune function."
  },
  {
    id: "fda-statin",
    source: "FDA",
    title: "Statin Medication Safety",
    content:
      "Statins lower cholesterol and can reduce cardiovascular risk for some patients. Possible adverse effects include muscle symptoms and rare liver enzyme abnormalities."
  }
];
