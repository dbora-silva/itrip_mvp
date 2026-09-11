// Seeds fixed local test users (and their trips/tasks) against a LOCAL Supabase instance
// only. Run via `npm run db:seed:users` (or automatically at the end of `npm run db:reset`).
//
// Safety model:
// - Credentials are read exclusively from `supabase status -o json`, never from
//   process.env / .env.local — there is no code path that could pick up a hosted
//   project's URL or key.
// - The gateway URL is parsed with `new URL()` and checked with strict equality against
//   an allowlist of local hostnames, not a substring/`.includes()` check.
// - The service-role key is held only in memory: never logged, never written to a file.
// - If any of this cannot be proven, the script exits non-zero before doing anything else.
//
// Idempotency model: re-running this without `supabase db reset` first must converge to
// the same logical state, not fail or duplicate data. See ensureUser() and
// replaceTripsForUser() below.

import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_TEST_PASSWORD = "ItripLocal123!";

function fail(message) {
  console.error(`[seed-users] ${message}`);
  process.exit(1);
}

function getLocalSupabaseStatus() {
  // Command passed as a single string (not command + args array) because Node warns
  // (DEP0190) about combining shell:true with a separate args array. There is no user
  // input in this command, so there is nothing to escape.
  const result = spawnSync("npx supabase status -o json", {
    encoding: "utf8",
    shell: true,
  });

  if (result.error || result.status !== 0) {
    fail(
      "could not run `supabase status` — is the local stack running? (`npm run supabase:start`)",
    );
  }

  const stdout = result.stdout ?? "";
  const jsonStart = stdout.indexOf("{");
  if (jsonStart === -1) {
    fail("`supabase status -o json` did not return a JSON object — refusing to proceed.");
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout.slice(jsonStart));
  } catch {
    fail("could not parse `supabase status -o json` output — refusing to proceed.");
  }

  if (typeof parsed.API_URL !== "string" || typeof parsed.SERVICE_ROLE_KEY !== "string") {
    fail("`supabase status -o json` output is missing API_URL or SERVICE_ROLE_KEY.");
  }

  return { apiUrl: parsed.API_URL, serviceRoleKey: parsed.SERVICE_ROLE_KEY };
}

function assertLocalUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail(`API_URL from \`supabase status\` is not a valid URL: "${rawUrl}"`);
  }

  if (url.protocol !== "http:") {
    fail(`Refusing to run against a non-local-looking protocol: "${url.protocol}"`);
  }
  if (!ALLOWED_HOSTNAMES.has(url.hostname)) {
    fail(`Refusing to run against non-local hostname: "${url.hostname}"`);
  }
  if (url.port === "") {
    fail("Refusing to run: the gateway URL has no explicit local port.");
  }
  if (url.username !== "" || url.password !== "") {
    fail("Refusing to run: the gateway URL unexpectedly contains credentials.");
  }

  return url.toString();
}

const { apiUrl, serviceRoleKey } = getLocalSupabaseStatus();
const verifiedLocalUrl = assertLocalUrl(apiUrl);

console.log(`[seed-users] Verified local Supabase gateway at ${verifiedLocalUrl}`);

const admin = createClient(verifiedLocalUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** @param {number} days */
function relativeDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const SEED_USERS = [
  {
    email: "debora@example.test",
    name: "Debora",
    trips: [
      {
        name: "Lua de mel em Portugal",
        destination: "Lisboa, Portugal",
        start_date: relativeDate(-20),
        end_date: relativeDate(-10),
        tasks: [],
      },
      {
        name: "Réveillon em Buenos Aires",
        destination: "Buenos Aires, Argentina",
        start_date: relativeDate(-2),
        end_date: relativeDate(3),
        tasks: [
          { title: "Reservar restaurante", status: "pending" },
          { title: "Comprar ingresso do show", status: "pending" },
          { title: "Trocar dinheiro", status: "completed" },
        ],
      },
      {
        name: "Trilha na Patagônia",
        destination: "Patagônia, Argentina",
        start_date: relativeDate(15),
        end_date: relativeDate(25),
        tasks: [{ title: "Alugar equipamento de trilha", status: "pending" }],
      },
      {
        name: "Aventura no Japão",
        destination: "Tóquio, Japão",
        start_date: relativeDate(60),
        end_date: relativeDate(75),
        tasks: [],
      },
    ],
  },
  {
    email: "hugo@example.test",
    name: "Hugo",
    trips: [
      {
        name: "Congresso em Lisboa",
        destination: "Lisboa, Portugal",
        start_date: relativeDate(-5),
        end_date: relativeDate(-1),
        tasks: [
          { title: "Imprimir crachá", status: "completed" },
          { title: "Preparar apresentação", status: "completed" },
          { title: "Reservar transfer do aeroporto", status: "completed" },
        ],
      },
      {
        name: "Feira de tecnologia",
        destination: "San Francisco, EUA",
        start_date: relativeDate(0),
        end_date: relativeDate(2),
        tasks: [
          { title: "Confirmar credenciamento", status: "completed" },
          { title: "Agendar reuniões", status: "completed" },
          { title: "Preparar cartões de visita", status: "pending" },
          { title: "Revisar roteiro de estandes", status: "pending" },
        ],
      },
      {
        name: "Escapada de fim de semana",
        destination: "Búzios, Brasil",
        start_date: relativeDate(30),
        end_date: relativeDate(32),
        tasks: [],
      },
      {
        name: "Expedição Antártica",
        destination: "Antártica",
        start_date: relativeDate(31),
        end_date: relativeDate(40),
        tasks: [{ title: "Comprar roupas térmicas", status: "pending" }],
      },
    ],
  },
];

async function findUserByEmail(email) {
  const perPage = 200;
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) fail(`listUsers failed: ${error.message}`);
    const match = data.users.find((user) => user.email === email);
    if (match) return match;
    if (data.users.length < perPage) break;
  }
  return null;
}

async function ensureUser(email, name) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: LOCAL_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });

  if (!error) {
    console.log(`[seed-users] created ${email}`);
    return data.user.id;
  }

  const alreadyExists = /already.*registered|already.*exists/i.test(error.message);
  if (!alreadyExists) {
    fail(`createUser(${email}) failed: ${error.message}`);
  }

  const existing = await findUserByEmail(email);
  if (!existing) {
    fail(`createUser(${email}) reported a conflict, but no matching user was found.`);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    password: LOCAL_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (updateError) fail(`updateUserById(${email}) failed: ${updateError.message}`);

  console.log(`[seed-users] reconciled existing ${email}`);
  return existing.id;
}

async function replaceTripsForUser(ownerId, trips) {
  // Scoped to this one seed user's own rows — never a broad delete. Cascades to tasks
  // via trips.id -> tasks.trip_id ON DELETE CASCADE.
  const { error: deleteError } = await admin.from("trips").delete().eq("owner_id", ownerId);
  if (deleteError) fail(`deleting existing trips for ${ownerId} failed: ${deleteError.message}`);

  for (const trip of trips) {
    const { data: insertedTrip, error: tripError } = await admin
      .from("trips")
      .insert({
        owner_id: ownerId,
        name: trip.name,
        destination: trip.destination,
        start_date: trip.start_date,
        end_date: trip.end_date,
      })
      .select("id")
      .single();

    if (tripError) fail(`inserting trip "${trip.name}" failed: ${tripError.message}`);

    if (trip.tasks.length > 0) {
      const { error: tasksError } = await admin.from("tasks").insert(
        trip.tasks.map((task) => ({
          trip_id: insertedTrip.id,
          title: task.title,
          status: task.status,
        })),
      );
      if (tasksError) fail(`inserting tasks for "${trip.name}" failed: ${tasksError.message}`);
    }
  }
}

for (const user of SEED_USERS) {
  const userId = await ensureUser(user.email, user.name);
  await replaceTripsForUser(userId, user.trips);
  console.log(`[seed-users] ${user.email}: ${user.trips.length} trips seeded`);
}

console.log("[seed-users] done.");
