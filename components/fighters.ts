export type Technique = {
  id: string;
  name: string;
  key: string;
  description: string;
  damage: number;
  range: number;
  cooldown: number;
  projectileSpeed: number;
  projectileSize: number;
  color: string;
};

export type Fighter = {
  id: "naruto" | "sasuke" | "sakura";
  name: string;
  clan: string;
  aura: string;
  speed: number;
  power: number;
  specials: Technique[];
  signature: string;
};

export const fighters: Fighter[] = [
  {
    id: "naruto",
    name: "Наруто Узумаки",
    clan: "Коноха",
    aura: "linear-gradient(160deg, #ffe066 0%, #ff922b 50%, #f76707 100%)",
    speed: 1.1,
    power: 1.05,
    signature: "Рассенган и Теневые Клоны",
    specials: [
      {
        id: "rasengan",
        name: "Рассенган",
        key: "K",
        description: "Высокоскоростной вихревой удар наносит большой урон вблизи.",
        damage: 24,
        range: 120,
        cooldown: 3600,
        projectileSpeed: 0,
        projectileSize: 40,
        color: "#f8c200"
      },
      {
        id: "shadow-clone",
        name: "Теневой Клон",
        key: "L",
        description: "Создаёт клон, который атакует противника на расстоянии.",
        damage: 14,
        range: 260,
        cooldown: 4200,
        projectileSpeed: 3.4,
        projectileSize: 22,
        color: "#ffe066"
      }
    ]
  },
  {
    id: "sasuke",
    name: "Саске Учиха",
    clan: "Учиха",
    aura: "linear-gradient(140deg, #748ffc 0%, #5f3dc4 40%, #364fc7 100%)",
    speed: 1.15,
    power: 1.1,
    signature: "Чидори и огненные техники",
    specials: [
      {
        id: "chidori",
        name: "Чидори",
        key: "K",
        description: "Молниеносный рывок пронзает противника высокой силой.",
        damage: 28,
        range: 160,
        cooldown: 3800,
        projectileSpeed: 0,
        projectileSize: 50,
        color: "#82c0ff"
      },
      {
        id: "katon",
        name: "Катон: Огненный шар",
        key: "L",
        description: "Выдыхает пылающий шар, который медленно летит вперёд.",
        damage: 18,
        range: 320,
        cooldown: 4500,
        projectileSpeed: 2.4,
        projectileSize: 36,
        color: "#ff6b6b"
      }
    ]
  },
  {
    id: "sakura",
    name: "Сакура Харуно",
    clan: "Коноха",
    aura: "linear-gradient(150deg, #ffc9de 0%, #f783ac 45%, #e64980 100%)",
    speed: 1.05,
    power: 1.2,
    signature: "Чакра-регистрация и разрушительные удары",
    specials: [
      {
        id: "chakra-punch",
        name: "Удар Чакрой",
        key: "K",
        description: "Сакура концентрирует чакру и наносит мощный удар по земле.",
        damage: 26,
        range: 140,
        cooldown: 3900,
        projectileSpeed: 0,
        projectileSize: 60,
        color: "#ff8fa3"
      },
      {
        id: "healing-seal",
        name: "Печать Исцеления",
        key: "L",
        description: "Активирует печать, мгновенно восстанавливая часть здоровья.",
        damage: -18,
        range: 0,
        cooldown: 5200,
        projectileSpeed: 0,
        projectileSize: 0,
        color: "#ffd6ff"
      }
    ]
  }
];
