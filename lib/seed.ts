import type { Store } from "./types";
import { buildBigFamily } from "./bigFamily";

// The mock "session" — everything you create is attributed to this user.
export const CURRENT_USER_ID = "u-you";

const t = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString();

// Placeholder "photos" as self-contained SVG data URLs — no storage backend
// needed for the mock, and they persist in localStorage like real uploads.
function svgPhoto(from: string, to: string, emoji: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><text x="320" y="235" font-size="110" text-anchor="middle">${emoji}</text><text x="320" y="330" font-size="26" font-family="Georgia, serif" fill="rgba(255,255,255,0.9)" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function buildSeed(): Store {
  const big = buildBigFamily("f-ghebre", CURRENT_USER_ID, t(400));

  return {
    users: [
      { id: CURRENT_USER_ID, name: "Jordan Rivera", email: "you@example.com", color: "#0f766e" },
      { id: "u-maya", name: "Maya Rivera", email: "maya@example.com", color: "#b45309" },
      { id: "u-carol", name: "Carol Reyes", email: "carol@example.com", color: "#7c3aed" },
      { id: "u-marcus", name: "Marcus Rivera", email: "marcus@example.com", color: "#be123c" },
    ],

    families: [
      { id: "f-rivera", name: "The Rivera Family", createdAt: t(240), createdById: CURRENT_USER_ID },
      { id: "f-reyes", name: "Reyes Extended Family", createdAt: t(90), createdById: "u-carol" },
      { id: "f-ghebre", name: "Ghebre Family — 7 generations", createdAt: t(400), createdById: CURRENT_USER_ID },
    ],

    memberships: [
      { id: "m1", userId: CURRENT_USER_ID, familyId: "f-rivera", joinedAt: t(240) },
      { id: "m2", userId: "u-maya", familyId: "f-rivera", joinedAt: t(200) },
      { id: "m3", userId: "u-carol", familyId: "f-rivera", joinedAt: t(180) },
      { id: "m4", userId: "u-marcus", familyId: "f-rivera", joinedAt: t(120) },
      { id: "m5", userId: "u-carol", familyId: "f-reyes", joinedAt: t(90) },
      { id: "m6", userId: CURRENT_USER_ID, familyId: "f-ghebre", joinedAt: t(400) },
      { id: "m7", userId: "u-marcus", familyId: "f-ghebre", joinedAt: t(300) },
    ],

    invites: [
      {
        id: "inv-1",
        code: "RIVERA-HOME",
        familyId: "f-rivera",
        createdById: CURRENT_USER_ID,
        createdAt: t(200),
      },
      {
        id: "inv-2",
        code: "REYES-2024",
        familyId: "f-reyes",
        createdById: "u-carol",
        createdAt: t(90),
      },
    ],

    people: [
      // Generation 0
      { id: "p-miguel", familyId: "f-rivera", name: "Miguel Rivera", birthYear: "1938", deathYear: "2011", gender: "male", notes: "Founded the family bakery in 1963. Everyone's recipes trace back to him.", details: { birthCity: "Quetzaltenango, Guatemala", funnyStories: "Once biked 40 km to deliver a wedding cake after the truck broke down — arrived with the cake intact and his shoes ruined." }, addedById: CURRENT_USER_ID, createdAt: t(240) },
      { id: "p-elena", familyId: "f-rivera", name: "Elena Rivera", birthYear: "1942", notes: "Still lives in the old house on Calle Sol. Keeper of the photo albums.", birthDate: "1942-03-14", lifeStatus: "living", gender: "female", details: { birthCity: "Antigua Guatemala", currentCity: "Antigua Guatemala", phone: "+502 5555 0142" }, addedById: CURRENT_USER_ID, createdAt: t(240) },
      { id: "p-ernesto", familyId: "f-rivera", name: "Ernesto Rivera", birthYear: "1935", deathYear: "1998", notes: "Great-uncle Ernesto. Carol remembers him from childhood summers; Marcus isn't convinced he was Miguel's brother.", addedById: "u-carol", createdAt: t(150) },

      // Generation 1
      { id: "p-carlos", familyId: "f-rivera", name: "Carlos Rivera", birthYear: "1965", details: { currentCity: "San Diego, CA", jobs: "Ran the bakery until 2019; now teaches baking classes.", phone: "+1 (619) 555-0117" }, addedById: CURRENT_USER_ID, createdAt: t(238) },
      { id: "p-diana", familyId: "f-rivera", name: "Diana Rivera", birthYear: "1968", details: { currentCity: "San Diego, CA", college: "SDSU, Class of ’90", email: "diana@example.com" }, addedById: "u-maya", createdAt: t(198) },
      { id: "p-sofia", familyId: "f-rivera", name: "Sofía Reyes", birthYear: "1970", addedById: "u-carol", createdAt: t(178) },
      { id: "p-tomas", familyId: "f-rivera", name: "Tomás Reyes", birthYear: "1967", addedById: "u-carol", createdAt: t(178) },

      // Generation 2
      { id: "p-jordan", familyId: "f-rivera", name: "Jordan Rivera", birthYear: "1994", lifeStatus: "living", accountUserId: CURRENT_USER_ID, details: { currentCity: "San Diego, CA", college: "UC San Diego, Class of 2016", linkedin: "https://linkedin.com/in/jordan-rivera-example", travelPlans: "Guatemala trip with Maya over the holidays." }, addedById: CURRENT_USER_ID, createdAt: t(240) },
      { id: "p-maya", familyId: "f-rivera", name: "Maya Rivera", birthYear: "1997", lifeStatus: "living", gender: "female", accountUserId: "u-maya", details: { currentCity: "Austin, TX", college: "UT Austin, Class of 2019", instagram: "https://instagram.com/maya.example" }, addedById: CURRENT_USER_ID, createdAt: t(238) },
      { id: "p-lucia", familyId: "f-rivera", name: "Lucía Reyes", birthYear: "1999", addedById: "u-carol", createdAt: t(170) },

      ...big.people,
    ],

    relationships: [
      { id: "r1", familyId: "f-rivera", fromPersonId: "p-miguel", toPersonId: "p-elena", type: "SPOUSE_OF", addedById: CURRENT_USER_ID, createdAt: t(240) },
      { id: "r2", familyId: "f-rivera", fromPersonId: "p-miguel", toPersonId: "p-carlos", type: "PARENT_OF", addedById: CURRENT_USER_ID, createdAt: t(238) },
      { id: "r3", familyId: "f-rivera", fromPersonId: "p-elena", toPersonId: "p-carlos", type: "PARENT_OF", addedById: CURRENT_USER_ID, createdAt: t(238) },
      { id: "r4", familyId: "f-rivera", fromPersonId: "p-miguel", toPersonId: "p-sofia", type: "PARENT_OF", addedById: "u-carol", createdAt: t(178) },
      { id: "r5", familyId: "f-rivera", fromPersonId: "p-elena", toPersonId: "p-sofia", type: "PARENT_OF", addedById: "u-carol", createdAt: t(178) },
      { id: "r6", familyId: "f-rivera", fromPersonId: "p-carlos", toPersonId: "p-diana", type: "SPOUSE_OF", addedById: "u-maya", createdAt: t(198) },
      { id: "r7", familyId: "f-rivera", fromPersonId: "p-sofia", toPersonId: "p-tomas", type: "SPOUSE_OF", addedById: "u-carol", createdAt: t(178) },
      { id: "r8", familyId: "f-rivera", fromPersonId: "p-carlos", toPersonId: "p-jordan", type: "PARENT_OF", addedById: CURRENT_USER_ID, createdAt: t(240) },
      { id: "r9", familyId: "f-rivera", fromPersonId: "p-diana", toPersonId: "p-jordan", type: "PARENT_OF", addedById: "u-maya", createdAt: t(198) },
      { id: "r10", familyId: "f-rivera", fromPersonId: "p-carlos", toPersonId: "p-maya", type: "PARENT_OF", addedById: CURRENT_USER_ID, createdAt: t(238) },
      { id: "r11", familyId: "f-rivera", fromPersonId: "p-diana", toPersonId: "p-maya", type: "PARENT_OF", addedById: "u-maya", createdAt: t(198) },
      { id: "r12", familyId: "f-rivera", fromPersonId: "p-sofia", toPersonId: "p-lucia", type: "PARENT_OF", addedById: "u-carol", createdAt: t(170) },
      { id: "r13", familyId: "f-rivera", fromPersonId: "p-tomas", toPersonId: "p-lucia", type: "PARENT_OF", addedById: "u-carol", createdAt: t(170) },
      { id: "r14", familyId: "f-rivera", fromPersonId: "p-jordan", toPersonId: "p-maya", type: "SIBLING_OF", addedById: "u-maya", createdAt: t(196) },
      // The contested edge — Carol says Ernesto was Miguel's brother, Marcus disputes it.
      { id: "r15", familyId: "f-rivera", fromPersonId: "p-ernesto", toPersonId: "p-miguel", type: "SIBLING_OF", addedById: "u-carol", createdAt: t(150) },

      ...big.relationships,
    ],

    confirmations: [
      { id: "c1", relationshipId: "r1", userId: "u-maya", type: "CONFIRM", createdAt: t(195) },
      { id: "c2", relationshipId: "r1", userId: "u-carol", type: "CONFIRM", createdAt: t(175) },
      { id: "c3", relationshipId: "r2", userId: "u-marcus", type: "CONFIRM", createdAt: t(110) },
      { id: "c4", relationshipId: "r8", userId: "u-maya", type: "CONFIRM", createdAt: t(190) },
      { id: "c5", relationshipId: "r15", userId: "u-marcus", type: "DISPUTE", createdAt: t(115) },
      { id: "c6", relationshipId: "r15", userId: "u-maya", type: "CONFIRM", createdAt: t(140) },
      { id: "c7", relationshipId: "r7", userId: CURRENT_USER_ID, type: "CONFIRM", createdAt: t(160) },
    ],

    photos: [
      {
        id: "ph1",
        personId: "p-miguel",
        familyId: "f-rivera",
        dataUrl: svgPhoto("#115e59", "#78716c", "🥖", "The bakery on Calle Sol, 1975"),
        caption: "Miguel and Elena outside the bakery, 1975",
        taggedPersonIds: ["p-elena"],
        addedById: "u-carol",
        createdAt: t(140),
      },
      {
        id: "ph2",
        personId: "p-jordan",
        familyId: "f-rivera",
        dataUrl: svgPhoto("#b45309", "#0e7490", "🏞️", "Lake trip, summer 2019"),
        caption: "Jordan and Maya at the lake",
        taggedPersonIds: ["p-maya"],
        addedById: "u-maya",
        createdAt: t(90),
      },
    ],

    comments: [
      {
        id: "cm1",
        personId: "p-miguel",
        familyId: "f-rivera",
        userId: "u-marcus",
        text: "His pan dulce recipe is still unbeaten. Carol has the notebook.",
        createdAt: t(100),
      },
      {
        id: "cm2",
        personId: "p-elena",
        familyId: "f-rivera",
        userId: CURRENT_USER_ID,
        text: "Still wins every lotería night. Do not play her for money.",
        createdAt: t(30),
      },
    ],

    dismissedSuggestions: [],
    edits: [],
  };
}
