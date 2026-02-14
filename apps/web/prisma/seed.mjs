import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const collections = [
  { slug: "cult-midnight", title: "Cult / Midnight", description: "Seleccion rara y nocturna." },
  { slug: "noir", title: "Noir", description: "Sombras, crimen y misterio." },
  { slug: "grindhouse", title: "Grindhouse / Exploitation", description: "B-movie y exceso." },
  { slug: "thriller-misterio", title: "Thriller con misterio", description: "Giros y pistas." },
  { slug: "espana-80-90", title: "Espana 80/90 vibes", description: "Vibra retro local." },
  { slug: "joyas-ocultas", title: "Joyas ocultas", description: "Tesoros poco vistos." }
];

const genres = [
  "thriller",
  "drama",
  "horror",
  "action",
  "comedy",
  "mystery",
  "sci-fi",
  "crime",
  "fantasy",
  "romance"
];

const countries = ["ES", "US", "FR", "IT", "MX", "DE", "JP", "KR", "UK", "AR"];
const languages = ["es", "en", "fr", "it", "pt", "de", "ja", "ko"];
const trailerKinds = ["teaser", "trailer", "clip"];

function pick(list, index) {
  return list[index % list.length];
}

async function main() {
  await prisma.$transaction([
    prisma.userFeedback.deleteMany(),
    prisma.userWatchlist.deleteMany(),
    prisma.collectionItem.deleteMany(),
    prisma.collection.deleteMany(),
    prisma.titlePerson.deleteMany(),
    prisma.trailer.deleteMany(),
    prisma.title.deleteMany()
  ]);

  const createdCollections = [];
  for (const collection of collections) {
    const created = await prisma.collection.create({ data: collection });
    createdCollections.push(created);
  }

  const titleIds = [];
  for (let i = 1; i <= 200; i += 1) {
    const primaryGenre = pick(genres, i);
    const secondaryGenre = pick(genres, i + 3);
    const title = await prisma.title.create({
      data: {
        provider: "tmdb",
        providerId: `tmdb-${1000 + i}`,
        type: i % 2 === 0 ? "movie" : "tv",
        title: `Sample Title ${i}`,
        originalTitle: `Original Title ${i}`,
        year: 1980 + (i % 44),
        runtimeMinutes: 80 + (i % 60),
        overview: "Seeded overview for local development.",
        posterUrl: `https://image.tmdb.org/t/p/w500/sample-${i}.jpg`,
        backdropUrl: `https://image.tmdb.org/t/p/w1280/sample-${i}.jpg`,
        countries: [pick(countries, i)],
        languages: [pick(languages, i)],
        genres: [primaryGenre, secondaryGenre],
        trailers: {
          create: [
            {
              source: "youtube",
              sourceVideoId: `seed${i.toString().padStart(8, "0")}`,
              kind: pick(trailerKinds, i),
              language: pick(languages, i),
              durationSeconds: 90 + (i % 120),
              isOfficial: i % 3 === 0
            }
          ]
        },
        people: {
          create: [
            { personName: `Director ${i}`, role: "director", orderIndex: 1 },
            { personName: `Actor ${i}-1`, role: "actor", orderIndex: 1 },
            { personName: `Actor ${i}-2`, role: "actor", orderIndex: 2 },
            { personName: `Actor ${i}-3`, role: "actor", orderIndex: 3 }
          ]
        }
      }
    });

    titleIds.push(title.id);
  }

  for (let c = 0; c < createdCollections.length; c += 1) {
    const items = [];
    for (let i = 0; i < 20; i += 1) {
      const index = (c * 30 + i) % titleIds.length;
      items.push({
        collectionId: createdCollections[c].id,
        titleId: titleIds[index],
        orderIndex: i + 1
      });
    }
    await prisma.collectionItem.createMany({ data: items });
  }

  console.log("Seed completed: 200 titles + collections");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
