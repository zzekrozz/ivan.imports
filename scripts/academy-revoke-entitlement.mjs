import { adminRequest, emailReference, maskEmail, normalizeEmail, parseArgs, requireApplyConfig, validEmail } from "./_academy-entitlement-cli.mjs";

const args = parseArgs();
const email = normalizeEmail(args.values.email);
if (!validEmail(email)) throw new Error("Usa --email comprador@dominio.tld");

const plan = {
  mode: args.flags.has("apply") ? "apply-requested" : "dry-run",
  action: "revoke-entitlement",
  email: maskEmail(email),
  emailRef: emailReference(email),
  reason: args.values.reason || "manual-admin",
};
console.log(JSON.stringify(plan, null, 2));

if (!args.flags.has("apply")) {
  console.log("Dry-run: no se ha abierto ninguna conexión ni revocado un entitlement.");
  process.exit(0);
}
if (!args.flags.has("confirm-revoke")) throw new Error("Para aplicar añade --apply --confirm-revoke");

const config = requireApplyConfig(args);
await adminRequest(config, "revoke-entitlement", { email, reason: plan.reason }, `academy-revoke:${plan.emailRef}`);
console.log(JSON.stringify({ ok: true, action: plan.action, email: plan.email, emailRef: plan.emailRef }, null, 2));
