import { addDays, startOfWeek } from "date-fns";
import { dayKey, isoLocal, uid, WEEK } from "../lib/dates";
import type { Persona, SchoolSlot } from "../lib/types";
import { useApp } from "./store";

/** Famille d'exemple, datée autour d'aujourd'hui, pour découvrir tous les plugins. */
export function loadDemo() {
  const now = new Date();
  const monday = startOfWeek(now, WEEK);
  const k = (n: number) => dayKey(addDays(now, n));
  const at = (n: number, h: number, m = 0) => {
    const d = addDays(now, n);
    d.setHours(h, m, 0, 0);
    return isoLocal(d);
  };
  const slot = (weekday: number, start: string, end: string, subject: string, color: string): SchoolSlot => ({ id: uid(), weekday, start, end, subject, color });

  const nadia: Persona = {
    id: uid(), name: "Nadia", role: "adulte", color: "#f472b6", job: "Opératrice de production", hourlyRate: 13.8,
    birthday: "1990-" + dayKey(addDays(now, 9)).slice(5),
    avatar: { gender: "femme", hair: "long", glasses: false, beard: false, skin: 3, style: "notionists", seed: "nadia-k", opts: { beardProbability: 0, glassesProbability: 0 } },
    cycle: { enabled: true, lastStart: k(-10), cycleLength: 28, periodLength: 5, logs: [k(-38)], discreet: false },
  };
  const karim: Persona = {
    id: uid(), name: "Karim", role: "adulte", color: "#38bdf8", job: "Développeur", hourlyRate: 19.5, birthday: "1988-03-14",
    avatar: { gender: "homme", hair: "court", glasses: true, beard: true, skin: 3, style: "notionists", seed: "karim-k", opts: { beardProbability: 100, glassesProbability: 100 } },
  };
  const ines: Persona = {
    id: uid(), name: "Inès", role: "enfant", color: "#a78bfa", birthday: "2017-" + dayKey(addDays(now, 23)).slice(5),
    avatar: { gender: "femme", hair: "queue", glasses: false, beard: false, skin: 2, style: "notionists", seed: "ines-k", opts: { beardProbability: 0, glassesProbability: 0 } },
    school: {
      enabled: true, level: "CM1", establishment: "École Jules Ferry", followHolidays: true,
      timetable: [1, 2, 4, 5].flatMap((wd) => [slot(wd, "08:30", "11:45", "Classe", "#a78bfa"), slot(wd, "13:30", "16:30", "Classe", "#c4b5fd")]),
    },
  };
  const yanis: Persona = {
    id: uid(), name: "Yanis", role: "ado", color: "#34d399", birthday: "2013-06-02",
    avatar: { gender: "homme", hair: "boucle", glasses: false, beard: false, skin: 4, style: "notionists", seed: "yanis-k", opts: { beardProbability: 0, glassesProbability: 0 } },
    school: {
      enabled: true, level: "5e", establishment: "Collège Victor Hugo", followHolidays: true,
      timetable: [
        slot(1, "08:00", "10:00", "Maths", "#38bdf8"), slot(1, "10:15", "12:15", "Français", "#f472b6"), slot(1, "14:00", "16:00", "SVT", "#4ade80"),
        slot(2, "08:00", "12:00", "Anglais / Histoire", "#fbbf24"), slot(2, "13:30", "15:30", "EPS", "#fb923c"),
        slot(3, "08:00", "12:00", "Techno / Arts", "#c084fc"),
        slot(4, "09:00", "12:00", "Physique / Maths", "#38bdf8"), slot(4, "14:00", "17:00", "Espagnol / Musique", "#f43f5e"),
        slot(5, "08:00", "12:00", "Français / Histoire", "#f472b6"), slot(5, "13:30", "15:30", "EPS", "#fb923c"),
      ],
    },
  };
  const fatima: Persona = {
    id: uid(), name: "Mamie Fatima", role: "senior", color: "#fbbf24", birthday: "1952-" + dayKey(addDays(now, 4)).slice(5),
    avatar: { gender: "femme", hair: "chignon", glasses: true, beard: false, skin: 3, style: "notionists", seed: "fatima-k", opts: { beardProbability: 0, glassesProbability: 100 } },
  };

  const personas = [nadia, karim, ines, yanis, fatima];
  const projectStart = addDays(now, -6);

  useApp.getState().replaceData({
    personas,
    patterns: [
      { id: uid(), personaId: nadia.id, name: "3×8 continu (usine)", anchor: dayKey(addDays(monday, -2)), cycle: [..."MMAANNRR"], skipHolidays: true, from: dayKey(addDays(monday, -400)) },
      { id: uid(), personaId: karim.id, name: "Hybride", anchor: dayKey(monday), cycle: ["J", "T", "J", "T", "J", "R", "R"], skipHolidays: true, from: dayKey(addDays(monday, -400)) },
    ],
    leaves: [{ id: uid(), personaId: karim.id, type: "CP", start: k(12), end: k(16), note: "Vacances de la Toussaint" }],
    events: [
      {
        id: uid(), title: "Point d'équipe", kind: "meeting", start: isoLocal(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10)), end: isoLocal(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 30)),
        allDay: false, personaIds: [karim.id], meeting: { provider: "teams", url: "https://teams.microsoft.com/l/meetup-join/demo" }, recurrence: { freq: "weekly", interval: 1, byWeekday: [1, 3] }, reminderMin: 5,
      },
      { id: uid(), title: "Pédiatre — Dr Martin", kind: "appointment", start: at(4, 17, 15), end: at(4, 17, 45), allDay: false, personaIds: [ines.id, nadia.id], meeting: { provider: "doctolib", url: "https://www.doctolib.fr/" }, location: "Cabinet du centre", reminderMin: 60 },
      { id: uid(), title: "Entretien client", kind: "meeting", start: at(1, 14), end: at(1, 15), allDay: false, personaIds: [karim.id], meeting: { provider: "meet", url: "https://meet.google.com/abc-defg-hij" }, mail: { subject: "Re: Point projet jeudi", from: "Claire <claire@exemple.fr>" } },
      { id: uid(), title: "Foot", kind: "event", start: at(0, 14), end: at(0, 16), allDay: false, personaIds: [yanis.id], color: "#34d399", recurrence: { freq: "weekly", interval: 1, byWeekday: [3] } },
      { id: uid(), title: "Danse", kind: "event", start: at(0, 17, 30), end: at(0, 18, 30), allDay: false, personaIds: [ines.id], color: "#a78bfa", recurrence: { freq: "weekly", interval: 1, byWeekday: [6] } },
      { id: uid(), title: "Réunion parents-profs", kind: "event", start: at(5, 18), end: at(5, 19, 30), allDay: false, personaIds: [nadia.id, karim.id, yanis.id], location: "Collège Victor Hugo" },
      { id: uid(), title: "Repas chez Mamie", kind: "event", start: at(6, 12), end: at(6, 15), allDay: false, personaIds: personas.map((p) => p.id), color: "#fbbf24" },
      { id: uid(), title: "Week-end à la mer", kind: "event", start: `${k(13)}T00:00`, end: `${k(15)}T00:00`, allDay: true, personaIds: [karim.id, ines.id, yanis.id], color: "#06b6d4" },
    ],
    todos: [
      { id: uid(), title: "Renouveler la carte d'identité d'Inès", done: false, due: k(3), personaId: nadia.id, priority: 2, createdAt: now.toISOString() },
      { id: uid(), title: "Payer la cantine", done: false, due: k(1), personaId: karim.id, priority: 3, createdAt: now.toISOString() },
      { id: uid(), title: "Réserver le contrôle technique", done: false, priority: 1, createdAt: now.toISOString() },
      { id: uid(), title: "Rappeler la mutuelle", done: true, priority: 0, createdAt: now.toISOString() },
    ],
    shopping: [
      {
        id: uid(), name: "Courses de la semaine", kind: "courses", date: k(1), personaId: karim.id,
        items: ["lait", "pommes", "pâtes", "poulet", "yaourts", "lessive", "café", "tomates"].map((name) => ({ id: uid(), name, qty: "", done: false })),
      },
      {
        id: uid(), name: "Fournitures — Yanis", kind: "fournitures", date: k(4), personaId: nadia.id,
        items: ["cahier 24×32", "stylos bleus", "compas", "classeur A4", "copies doubles"].map((name) => ({ id: uid(), name, qty: "", done: false })),
      },
    ],
    deliveries: [
      { id: uid(), title: "Chaussures de foot", carrier: "Colissimo", tracking: "6A12345678901", date: k(1), slotStart: "08:00", slotEnd: "13:00", personaId: nadia.id, status: "en-route" },
      { id: uid(), title: "Commande Fnac", carrier: "Mondial Relay", date: k(3), slotStart: "14:00", slotEnd: "19:00", personaId: karim.id, status: "attendue", relay: "Tabac de la gare" },
    ],
    meals: [
      { id: uid(), date: k(0), slot: "soir", name: "Couscous", ingredients: ["semoule", "pois chiches", "courgettes", "carottes", "agneau"] },
      { id: uid(), date: k(1), slot: "midi", name: "Salade niçoise", ingredients: ["thon", "œufs", "olives", "tomates"] },
    ],
    money: [
      { id: uid(), label: "Salaire Karim", amount: 2650, type: "revenu", category: "Salaire", date: dayKey(new Date(now.getFullYear(), now.getMonth() - 2, 28)), repeat: "mensuel", personaId: karim.id },
      { id: uid(), label: "Loyer", amount: 1150, type: "depense", category: "Logement", date: dayKey(new Date(now.getFullYear(), now.getMonth() - 2, 5)), repeat: "mensuel" },
      { id: uid(), label: "Électricité", amount: 96, type: "depense", category: "Énergie", date: dayKey(new Date(now.getFullYear(), now.getMonth() - 2, 12)), repeat: "mensuel" },
      { id: uid(), label: "Cantine", amount: 84, type: "depense", category: "École", date: dayKey(new Date(now.getFullYear(), now.getMonth() - 1, 10)), repeat: "mensuel", personaId: ines.id },
      { id: uid(), label: "Courses", amount: 135, type: "depense", category: "Courses", date: dayKey(addDays(monday, -2)), repeat: "hebdo" },
      { id: uid(), label: "Netflix", amount: 13.49, type: "depense", category: "Abonnements", date: dayKey(new Date(now.getFullYear(), now.getMonth() - 1, 19)), repeat: "mensuel" },
      { id: uid(), label: "Allocations familiales", amount: 148, type: "revenu", category: "Allocations", date: dayKey(new Date(now.getFullYear(), now.getMonth() - 1, 5)), repeat: "mensuel" },
    ],
    projects: [
      {
        id: uid(), name: "Rénovation chambre d'Inès", color: "#a855f7", showInCalendar: true,
        tasks: (() => {
          const t1 = { id: uid(), name: "Choisir la peinture", start: dayKey(projectStart), end: dayKey(addDays(projectStart, 3)), progress: 100, personaId: nadia.id, dependsOn: [] as string[] };
          const t2 = { id: uid(), name: "Vider la chambre", start: dayKey(addDays(projectStart, 5)), end: dayKey(addDays(projectStart, 6)), progress: 60, personaId: karim.id, dependsOn: [t1.id] };
          const t3 = { id: uid(), name: "Peinture", start: dayKey(addDays(projectStart, 7)), end: dayKey(addDays(projectStart, 11)), progress: 0, personaId: karim.id, dependsOn: [t2.id] };
          const t4 = { id: uid(), name: "Montage des meubles", start: dayKey(addDays(projectStart, 12)), end: dayKey(addDays(projectStart, 14)), progress: 0, personaId: nadia.id, dependsOn: [t3.id] };
          return [t1, t2, t3, t4];
        })(),
      },
    ],
  });
  useApp.getState().setSettings({ onboarded: true, plugins: { ...useApp.getState().settings.plugins, meals: true } });
}
