// Dados iniciais: 34 personagens (ordem das telas de seleção) e os KCs
// lidos dos prints de 09/10/2026 e 16/10/2026.

export const SEED_CHARACTERS: string[] = [
  // Tela 1
  "Aeri Uchinaga", "Ningning", "Yu Jimin", "Luan Santana", "Kikyou",
  "Rami", "Lalisa", "Old Zeph", "Maninho Garcia",
  "Mestra Genkai", "Uber de Tartaruga", "Canudo de Plastico",
  // Tela 2
  "Daesung", "Serjao Berranteiro", "Zephro", "Sandara", "Shakira O'Neal",
  "Agust D", "Adrian Fahrenheit", "ZephCopyPaste", "MiniZeph", "Zephrina",
  "Chaeryeong", "Maya Natsume", "Enami Asa", "Wonyoung", "GDragon",
  // Tela 3
  "Sado", "Kim Taeyeon", "Brujeria", "Professor Jirafales", "Enfermeira Joy",
  "Park BOOM", "Lucas Silveira",
];

// Kill extra de Garm que o Paulo pediu para somar em 09/10 (sem personagem).
export const ADJUST_CHARACTER = "Ajuste manual";

type Week = Record<string, string>;

export const SEED_WEEKS: { week: string; data: Week }[] = [
  {
    week: "2026-10-09",
    data: {
      "Wonyoung": "Amon Ra 1211",
      "MiniZeph": "Orc Hero 749, Golden Thief Bug 615, Phreeoni 186, Eddga 58, Garm 58, Maya 15, Orc Lord 10, Moonlight Flower 2, Doppelganger 1",
      "Daesung": "Mistress 16, RSX 0806 5",
      "Serjao Berranteiro": "Osiris 48, Doppelganger 20, Maya 19, Phreeoni 2, Incantation Samurai 2",
      "Zephro": "Eddga 157, Tao Gunka 47, RSX 0806 13, Orc Lord 3, Bacsojin 2, Moonlight Flower 1, Aspect of Sol 1",
      "Sandara": "Ktullanux 559, Knight of Windstorm 120, Turtle General 106, Garm 9, Orc Hero 4",
      "Shakira O'Neal": "Phreeoni 3, Garm 2, Moonlight Flower 1",
      "Agust D": "Logi 1",
      "Adrian Fahrenheit": "Evil Snake Lord 98, Dracula 47, Tao Gunka 17, Moonlight Flower 2, Bacsojin 1",
      "ZephCopyPaste": "Logi 312, Lady Huo 140, Lord of Death 3, Knight of Windstorm 2, Mistress 2, Orc Lord 1, Golden Thief Bug 1, Garm 1, Dark Lord 1, Turtle General 1",
      "Zephrina": "Lady Huo 11, Aspect of Sol 8, Lord of Death 5, Eddga 4, Logi 4, Pharaoh 3, Dracula 3, Golden Thief Bug 3, Turtle General 2, Incantation Samurai 2",
      "Enami Asa": "Pharaoh 258",
      "GDragon": "Moonlight Flower 2, Eddga 1, Knight of Windstorm 1, Turtle General 1, Dracula 1, Amon Ra 1, Bacsojin 1, King Poring 1",
      "Kim Taeyeon": "Moonlight Flower 11, Dracula 1",
      "Brujeria": "Orc Hero 527, Turtle General 2",
      "Professor Jirafales": "Dark Lord 57, King Poring 21, Orc Hero 8, Orc Lord 7, Evil Snake Lord 7, Osiris 6, Golden Thief Bug 5, Moonlight Flower 5, Mistress 4, Eddga 4",
      "Kikyou": "Moonlight Flower 205, Garm 95, Ktullanux 48, Knight of Windstorm 28, Orc Lord 20, Lady Huo 16, Mistress 16, Detale 14, Aspect of Sol 13, Eddga 11",
      "Rami": "Dark Lord 28, Golden Thief Bug 11, Phreeoni 10, King Poring 7, Garm 6, Knight of Windstorm 3, Osiris 3, Eddga 2, Drake 2, Mistress 2",
      "Mestra Genkai": "RSX 0806 29, Lady Huo 22, Logi 5, Garm 4, Dracula 4, Drake 4, Lord of Death 3, Evil Snake Lord 3, Aspect of Sol 3, Doppelganger 3",
      [ADJUST_CHARACTER]: "Garm 1",
    },
  },
  {
    // Só o que mudou ou apareceu; o resto continua valendo o último valor.
    week: "2026-10-16",
    data: {
      "Wonyoung": "Amon Ra 1246",
      "MiniZeph": "Golden Thief Bug 650, Phreeoni 201, Eddga 65",
      "Sandara": "Turtle General 164",
      "Adrian Fahrenheit": "Evil Snake Lord 106",
      "Enami Asa": "Pharaoh 259",
      "Kim Taeyeon": "Moonlight Flower 58",
      "Brujeria": "Orc Hero 566",
      "Professor Jirafales": "Dark Lord 59",
      "Kikyou": "Garm 111, Lord of Death 12",
      "Rami": "Garm 10",
      "Mestra Genkai": "RSX 0806 31, Lady Huo 23, Garm 5, Incantation Samurai 4, Amon Ra 4, Mistress 4",
    },
  },
];

export function parseList(s: string): { mvp: string; kills: number }[] {
  return s.split(",").map((it) => {
    const t = it.trim();
    const i = t.lastIndexOf(" ");
    return { mvp: t.slice(0, i), kills: parseInt(t.slice(i + 1), 10) };
  });
}

export function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Atualizações de KC lançadas pelo Claude a partir dos prints (aplicadas uma vez cada).
export const KC_UPDATES: { key: string; week: string; newCharacters?: string[]; data: Record<string, string> }[] = [
  {
    key: "kc-2026-10-23",
    week: "2026-10-23",
    data: {
      "Brujeria": "Orc Hero 618",
      "Daesung": "Lady Tanee 1",
      "Sandara": "Turtle General 234",
      "MiniZeph": "Golden Thief Bug 677, Phreeoni 218, Eddga 74",
      "Enami Asa": "Pharaoh 268",
      "Wonyoung": "Amon Ra 1281",
      "Kim Taeyeon": "Moonlight Flower 109",
      "Lucas Silveira": "Maya 1",
      "Professor Jirafales": "Dark Lord 60",
      "Rami": "Garm 33",
      "Mestra Genkai": "RSX 0806 34, Mistress 11, Aspect of Sol 5",
    },
  },
  {
    key: "kc-2026-10-30",
    week: "2026-10-30",
    newCharacters: ["Trappin Hood"],
    data: {
      "Sandara": "Turtle General 283",
      "MiniZeph": "Golden Thief Bug 704, Phreeoni 227, Eddga 78",
      "Enami Asa": "Pharaoh 280",
      "Wonyoung": "Amon Ra 1302",
      "Kim Taeyeon": "Moonlight Flower 143, Dracula 2",
      "Brujeria": "Orc Hero 657",
      "Lucas Silveira": "Maya 11, Orc Lord 4",
      "Rami": "Garm 45",
      "Trappin Hood": "Knight of Windstorm 4",
      "Mestra Genkai": "RSX 0806 38, Lady Huo 24, Mistress 15, Aspect of Sol 7, Lord of Death 7, Garm 6, Logi 6, Amon Ra 5, Eddga 5, Incantation Samurai 5",
    },
  },
];
