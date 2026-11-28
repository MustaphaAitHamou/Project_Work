#!/usr/bin/env node
// Tamurt Jobs — generates the Supabase Auth e-mail templates (supabase/templates/*.html) and
// their subjects (supabase/templates/subjects.json) from one layout and the texts below.
//
//   node scripts/generate-auth-email-templates.mjs
//
// - Language: read from the user's metadata (`locale`, set at sign-up and in the settings),
//   French when absent. Written defensively: a missing value never breaks the template.
// - Links go to {{ .SiteURL }}/auth/confirm (token_hash + type): the site then asks for one
//   click before using the one-time token (mail filters that open links do not use it up).
// - E-mail-safe HTML: tables, inline styles, no image (logo drawn in text), no web font.
// The same files are used by the local stack (supabase/config.toml) and, through
// scripts/supabase-auth-config.mjs or by hand, by the hosted projects.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "supabase", "templates");
const LOCALES = ["fr", "en", "es", "ar"];
const PICK_LOCALE = '{{ $l := "fr" }}{{ with .Data }}{{ with .locale }}{{ $l = printf "%v" . }}{{ end }}{{ end }}';

const COMMON = {
  fallback: {
    fr: "Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :",
    en: "Button not working? Copy this link into your browser:",
    es: "¿El botón no funciona? Copie este enlace en su navegador:",
    ar: "الزر لا يعمل؟ انسخوا هذا الرابط في متصفحكم:",
  },
  footer: {
    fr: "Vous recevez cet e-mail à la suite d'une action sur votre compte Tamurt Jobs. Offres d'emploi d'entreprises vérifiées, candidature gratuite.",
    en: "You are receiving this e-mail because of an action on your Tamurt Jobs account. Jobs from verified companies, free to apply.",
    es: "Recibe este correo por una acción en su cuenta de Tamurt Jobs. Ofertas de empresas verificadas, candidatura gratuita.",
    ar: "تصلكم هذه الرسالة بسبب إجراء على حسابكم في Tamurt Jobs. وظائف لدى شركات موثّقة، والتقديم مجاني.",
  },
  oneHour: {
    fr: "Ce lien est valable 1 heure et ne sert qu'une fois.",
    en: "This link is valid for 1 hour and works only once.",
    es: "Este enlace es válido durante 1 hora y solo funciona una vez.",
    ar: "هذا الرابط صالح لمدة ساعة واحدة ويعمل مرة واحدة فقط.",
  },
};

const link = (type) => `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;locale={{ $l }}`;
const forgotLink = "{{ .SiteURL }}/{{ $l }}/forgot-password";

/** kind: "link" (button + fallback link), "code" (one-time code), "notice" (security notification). */
const TEMPLATES = {
  confirmation: {
    kind: "link",
    href: link("email"),
    subject: { fr: "Confirmez votre adresse e-mail", en: "Confirm your e-mail address", es: "Confirme su dirección de correo", ar: "أكّدوا عنوان بريدكم الإلكتروني" },
    body: {
      fr: ["Bienvenue sur Tamurt Jobs. Pour activer votre compte, confirmez que cette adresse vous appartient."],
      en: ["Welcome to Tamurt Jobs. To activate your account, confirm that this address is yours."],
      es: ["Bienvenido a Tamurt Jobs. Para activar su cuenta, confirme que esta dirección le pertenece."],
      ar: ["مرحبًا بكم في Tamurt Jobs. لتفعيل حسابكم، أكّدوا أن هذا العنوان يخصّكم."],
    },
    button: { fr: "Confirmer mon adresse", en: "Confirm my address", es: "Confirmar mi dirección", ar: "تأكيد عنواني" },
    note: COMMON.oneHour,
    ignore: {
      fr: "Vous n'avez pas créé de compte ? Ignorez cet e-mail : aucun compte ne sera activé.",
      en: "Didn't create an account? Ignore this e-mail: no account will be activated.",
      es: "¿No ha creado una cuenta? Ignore este correo: no se activará ninguna cuenta.",
      ar: "لم تُنشئوا حسابًا؟ تجاهلوا هذه الرسالة: لن يُفعَّل أي حساب.",
    },
  },
  recovery: {
    kind: "link",
    href: link("recovery"),
    subject: { fr: "Réinitialisez votre mot de passe", en: "Reset your password", es: "Restablezca su contraseña", ar: "إعادة تعيين كلمة المرور" },
    body: {
      fr: ["Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Tamurt Jobs."],
      en: ["We received a request to reset the password of your Tamurt Jobs account."],
      es: ["Hemos recibido una solicitud para restablecer la contraseña de su cuenta de Tamurt Jobs."],
      ar: ["تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابكم على Tamurt Jobs."],
    },
    button: { fr: "Choisir un nouveau mot de passe", en: "Choose a new password", es: "Elegir una nueva contraseña", ar: "اختيار كلمة مرور جديدة" },
    note: COMMON.oneHour,
    ignore: {
      fr: "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe reste inchangé.",
      en: "Didn't ask for this? Ignore this e-mail: your password stays the same.",
      es: "¿No lo ha solicitado? Ignore este correo: su contraseña no cambia.",
      ar: "لم تطلبوا ذلك؟ تجاهلوا هذه الرسالة: تبقى كلمة مروركم دون تغيير.",
    },
  },
  email_change: {
    kind: "link",
    href: link("email_change"),
    subject: { fr: "Confirmez votre nouvelle adresse e-mail", en: "Confirm your new e-mail address", es: "Confirme su nueva dirección de correo", ar: "أكّدوا عنوان بريدكم الإلكتروني الجديد" },
    body: {
      fr: ["Vous avez demandé à remplacer l'adresse de votre compte Tamurt Jobs ({{ .Email }}) par {{ .NewEmail }}.", "Par sécurité, ce changement doit être confirmé depuis l'ancienne et la nouvelle adresse."],
      en: ["You asked to replace the address of your Tamurt Jobs account ({{ .Email }}) with {{ .NewEmail }}.", "For security, the change must be confirmed from both the old and the new address."],
      es: ["Ha solicitado sustituir la dirección de su cuenta de Tamurt Jobs ({{ .Email }}) por {{ .NewEmail }}.", "Por seguridad, el cambio debe confirmarse desde la dirección antigua y la nueva."],
      ar: ["طلبتم استبدال عنوان حسابكم على Tamurt Jobs ({{ .Email }}) بالعنوان {{ .NewEmail }}.", "لأسباب أمنية، يجب تأكيد هذا التغيير من العنوانين القديم والجديد."],
    },
    button: { fr: "Confirmer le changement", en: "Confirm the change", es: "Confirmar el cambio", ar: "تأكيد التغيير" },
    note: COMMON.oneHour,
    ignore: {
      fr: "Vous n'avez rien demandé ? Ignorez cet e-mail et changez votre mot de passe par précaution.",
      en: "Didn't ask for this? Ignore this e-mail and change your password as a precaution.",
      es: "¿No lo ha solicitado? Ignore este correo y cambie su contraseña por precaución.",
      ar: "لم تطلبوا ذلك؟ تجاهلوا هذه الرسالة وغيّروا كلمة المرور احتياطًا.",
    },
  },
  magic_link: {
    kind: "link",
    href: link("magiclink"),
    subject: { fr: "Votre lien de connexion", en: "Your sign-in link", es: "Su enlace de inicio de sesión", ar: "رابط تسجيل الدخول الخاص بكم" },
    body: {
      fr: ["Utilisez ce lien pour vous connecter à Tamurt Jobs."],
      en: ["Use this link to sign in to Tamurt Jobs."],
      es: ["Use este enlace para iniciar sesión en Tamurt Jobs."],
      ar: ["استخدموا هذا الرابط لتسجيل الدخول إلى Tamurt Jobs."],
    },
    button: { fr: "Me connecter", en: "Sign in", es: "Iniciar sesión", ar: "تسجيل الدخول" },
    note: COMMON.oneHour,
    ignore: {
      fr: "Vous n'avez rien demandé ? Ignorez cet e-mail.",
      en: "Didn't ask for this? Ignore this e-mail.",
      es: "¿No lo ha solicitado? Ignore este correo.",
      ar: "لم تطلبوا ذلك؟ تجاهلوا هذه الرسالة.",
    },
  },
  invite: {
    kind: "link",
    href: link("invite"),
    subject: { fr: "Votre invitation sur Tamurt Jobs", en: "Your invitation to Tamurt Jobs", es: "Su invitación a Tamurt Jobs", ar: "دعوتكم إلى Tamurt Jobs" },
    body: {
      fr: ["Un compte Tamurt Jobs a été créé pour vous. Confirmez votre adresse pour l'activer."],
      en: ["A Tamurt Jobs account was created for you. Confirm your address to activate it."],
      es: ["Se ha creado una cuenta de Tamurt Jobs para usted. Confirme su dirección para activarla."],
      ar: ["أُنشئ لكم حساب على Tamurt Jobs. أكّدوا عنوانكم لتفعيله."],
    },
    button: { fr: "Accepter l'invitation", en: "Accept the invitation", es: "Aceptar la invitación", ar: "قبول الدعوة" },
    note: COMMON.oneHour,
    ignore: {
      fr: "Vous ne vous attendiez pas à cette invitation ? Ignorez cet e-mail.",
      en: "Not expecting this invitation? Ignore this e-mail.",
      es: "¿No esperaba esta invitación? Ignore este correo.",
      ar: "لم تكونوا تنتظرون هذه الدعوة؟ تجاهلوا هذه الرسالة.",
    },
  },
  reauthentication: {
    kind: "code",
    subject: { fr: "Votre code de vérification : {{ .Token }}", en: "Your verification code: {{ .Token }}", es: "Su código de verificación: {{ .Token }}", ar: "رمز التحقق الخاص بكم: {{ .Token }}" },
    body: {
      fr: ["Saisissez ce code pour confirmer l'opération en cours sur votre compte Tamurt Jobs :"],
      en: ["Enter this code to confirm the operation in progress on your Tamurt Jobs account:"],
      es: ["Introduzca este código para confirmar la operación en curso en su cuenta de Tamurt Jobs:"],
      ar: ["أدخلوا هذا الرمز لتأكيد العملية الجارية على حسابكم في Tamurt Jobs:"],
    },
    note: { fr: "Ce code est valable 1 heure.", en: "This code is valid for 1 hour.", es: "Este código es válido durante 1 hora.", ar: "هذا الرمز صالح لمدة ساعة واحدة." },
    ignore: {
      fr: "Vous n'êtes pas à l'origine de cette demande ? Changez votre mot de passe sans attendre.",
      en: "Didn't ask for this? Change your password right away.",
      es: "¿No lo ha solicitado? Cambie su contraseña de inmediato.",
      ar: "لم تطلبوا ذلك؟ غيّروا كلمة المرور فورًا.",
    },
  },
  password_changed_notification: {
    kind: "notice",
    href: forgotLink,
    subject: { fr: "Votre mot de passe a été modifié", en: "Your password was changed", es: "Su contraseña ha sido cambiada", ar: "تم تغيير كلمة المرور الخاصة بكم" },
    body: {
      fr: ["Le mot de passe de votre compte Tamurt Jobs ({{ .Email }}) vient d'être modifié."],
      en: ["The password of your Tamurt Jobs account ({{ .Email }}) has just been changed."],
      es: ["La contraseña de su cuenta de Tamurt Jobs ({{ .Email }}) acaba de cambiarse."],
      ar: ["تم للتو تغيير كلمة مرور حسابكم على Tamurt Jobs ({{ .Email }})."],
    },
    button: { fr: "Réinitialiser mon mot de passe", en: "Reset my password", es: "Restablecer mi contraseña", ar: "إعادة تعيين كلمة المرور" },
    ignore: {
      fr: "C'est vous ? Il n'y a rien à faire. Sinon, réinitialisez votre mot de passe sans attendre.",
      en: "Was it you? There is nothing to do. Otherwise, reset your password right away.",
      es: "¿Fue usted? No tiene que hacer nada. Si no, restablezca su contraseña de inmediato.",
      ar: "هل كنتم أنتم؟ لا داعي لأي إجراء. وإلا فأعيدوا تعيين كلمة المرور فورًا.",
    },
  },
  email_changed_notification: {
    kind: "notice",
    href: forgotLink,
    subject: { fr: "L'adresse e-mail de votre compte a été modifiée", en: "The e-mail address of your account was changed", es: "La dirección de correo de su cuenta ha sido cambiada", ar: "تم تغيير عنوان البريد الإلكتروني لحسابكم" },
    body: {
      fr: ["L'adresse e-mail de votre compte Tamurt Jobs vient d'être modifiée."],
      en: ["The e-mail address of your Tamurt Jobs account has just been changed."],
      es: ["La dirección de correo de su cuenta de Tamurt Jobs acaba de cambiarse."],
      ar: ["تم للتو تغيير عنوان البريد الإلكتروني لحسابكم على Tamurt Jobs."],
    },
    button: { fr: "Réinitialiser mon mot de passe", en: "Reset my password", es: "Restablecer mi contraseña", ar: "إعادة تعيين كلمة المرور" },
    ignore: {
      fr: "C'est vous ? Il n'y a rien à faire. Sinon, réinitialisez votre mot de passe sans attendre.",
      en: "Was it you? There is nothing to do. Otherwise, reset your password right away.",
      es: "¿Fue usted? No tiene que hacer nada. Si no, restablezca su contraseña de inmediato.",
      ar: "هل كنتم أنتم؟ لا داعي لأي إجراء. وإلا فأعيدوا تعيين كلمة المرور فورًا.",
    },
  },
  mfa_factor_enrolled_notification: {
    kind: "notice",
    href: forgotLink,
    subject: { fr: "Une méthode de vérification a été ajoutée à votre compte", en: "A verification method was added to your account", es: "Se ha añadido un método de verificación a su cuenta", ar: "أُضيفت طريقة تحقق إلى حسابكم" },
    body: {
      fr: ["Une application d'authentification vient d'être ajoutée à votre compte Tamurt Jobs ({{ .Email }})."],
      en: ["An authenticator app has just been added to your Tamurt Jobs account ({{ .Email }})."],
      es: ["Se acaba de añadir una aplicación de autenticación a su cuenta de Tamurt Jobs ({{ .Email }})."],
      ar: ["أُضيف للتو تطبيق مصادقة إلى حسابكم على Tamurt Jobs ({{ .Email }})."],
    },
    button: { fr: "Réinitialiser mon mot de passe", en: "Reset my password", es: "Restablecer mi contraseña", ar: "إعادة تعيين كلمة المرور" },
    ignore: {
      fr: "C'est vous ? Il n'y a rien à faire. Sinon, réinitialisez votre mot de passe et prévenez l'équipe Tamurt Jobs.",
      en: "Was it you? There is nothing to do. Otherwise, reset your password and tell the Tamurt Jobs team.",
      es: "¿Fue usted? No tiene que hacer nada. Si no, restablezca su contraseña y avise al equipo de Tamurt Jobs.",
      ar: "هل كنتم أنتم؟ لا داعي لأي إجراء. وإلا فأعيدوا تعيين كلمة المرور وأبلغوا فريق Tamurt Jobs.",
    },
  },
  mfa_factor_unenrolled_notification: {
    kind: "notice",
    href: forgotLink,
    subject: { fr: "Une méthode de vérification a été retirée de votre compte", en: "A verification method was removed from your account", es: "Se ha eliminado un método de verificación de su cuenta", ar: "أُزيلت طريقة تحقق من حسابكم" },
    body: {
      fr: ["Une application d'authentification vient d'être retirée de votre compte Tamurt Jobs ({{ .Email }})."],
      en: ["An authenticator app has just been removed from your Tamurt Jobs account ({{ .Email }})."],
      es: ["Se acaba de eliminar una aplicación de autenticación de su cuenta de Tamurt Jobs ({{ .Email }})."],
      ar: ["أُزيل للتو تطبيق مصادقة من حسابكم على Tamurt Jobs ({{ .Email }})."],
    },
    button: { fr: "Réinitialiser mon mot de passe", en: "Reset my password", es: "Restablecer mi contraseña", ar: "إعادة تعيين كلمة المرور" },
    ignore: {
      fr: "C'est vous ? Il n'y a rien à faire. Sinon, réinitialisez votre mot de passe et prévenez l'équipe Tamurt Jobs.",
      en: "Was it you? There is nothing to do. Otherwise, reset your password and tell the Tamurt Jobs team.",
      es: "¿Fue usted? No tiene que hacer nada. Si no, restablezca su contraseña y avise al equipo de Tamurt Jobs.",
      ar: "هل كنتم أنتم؟ لا داعي لأي إجراء. وإلا فأعيدوا تعيين كلمة المرور وأبلغوا فريق Tamurt Jobs.",
    },
  },
};

const FONT = "font-family:Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const P = `margin:0 0 14px;font-size:15px;line-height:1.6;color:#0d1430;${FONT}`;

function content(t, locale) {
  const parts = [`<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:800;color:#0d1430;${FONT}">${t.subject[locale].replace(/[:：]\s*\{\{ \.Token \}\}$/, "")}</h1>`];
  for (const p of t.body[locale]) parts.push(`<p style="${P}">${p}</p>`);
  if (t.kind === "code") {
    parts.push(`<p style="margin:8px 0 18px;"><span style="display:inline-block;padding:14px 22px;border-radius:12px;background:#ebf0ff;color:#172c82;font-size:28px;font-weight:800;letter-spacing:6px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;">{{ .Token }}</span></p>`);
  } else {
    parts.push(
      `<p style="margin:22px 0 22px;"><a href="${t.href}" style="display:inline-block;padding:14px 26px;border-radius:10px;background:#2446d6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;${FONT}">${t.button[locale]}</a></p>`,
    );
  }
  if (t.note) parts.push(`<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4a5470;${FONT}">${t.note[locale]}</p>`);
  if (t.kind === "link") {
    parts.push(
      `<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#4a5470;${FONT}">${COMMON.fallback[locale]}<br><a href="${t.href}" style="color:#2446d6;word-break:break-all;">${t.href}</a></p>`,
    );
  }
  parts.push(`<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #e1e6f0;font-size:13px;line-height:1.6;color:#4a5470;${FONT}">${t.ignore[locale]}</p>`);
  return parts.join("\n");
}

function byLocale(fn) {
  return `{{ if eq $l "en" }}${fn("en")}{{ else if eq $l "es" }}${fn("es")}{{ else if eq $l "ar" }}${fn("ar")}{{ else }}${fn("fr")}{{ end }}`;
}

function page(t) {
  return `${PICK_LOCALE}<!doctype html>
<html lang="{{ $l }}" dir="{{ if eq $l "ar" }}rtl{{ else }}ltr{{ end }}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Tamurt Jobs</title></head>
<body style="margin:0;padding:0;background:#f6f8fc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e1e6f0;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0b1640;padding:20px 28px;text-align:{{ if eq $l "ar" }}right{{ else }}left{{ end }};" dir="ltr"><span style="color:#ff4d5e;font-size:17px;font-weight:800;letter-spacing:2px;${FONT};">TAMURT</span><span style="color:#8ca6ff;font-size:20px;font-weight:800;${FONT};"> Jobs</span></td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:#f6c445;">&nbsp;</td></tr>
<tr><td style="padding:30px 28px 26px;text-align:{{ if eq $l "ar" }}right{{ else }}left{{ end }};">
${byLocale((l) => content(t, l))}
</td></tr>
<tr><td style="padding:18px 28px;background:#f6f8fc;border-top:1px solid #e1e6f0;font-size:12px;line-height:1.6;color:#4a5470;text-align:{{ if eq $l "ar" }}right{{ else }}left{{ end }};${FONT}">
${byLocale((l) => COMMON.footer[l])}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
const subjects = {};
for (const [name, t] of Object.entries(TEMPLATES)) {
  for (const l of LOCALES) for (const key of ["subject", "body", ...(t.button ? ["button"] : []), "ignore"]) if (!t[key]?.[l]) throw new Error(`${name}: ${key}.${l} missing`);
  writeFileSync(path.join(OUT, `${name}.html`), page(t));
  subjects[name] = `${PICK_LOCALE}${byLocale((l) => `${t.subject[l]} · Tamurt Jobs`)}`;
}
writeFileSync(path.join(OUT, "subjects.json"), JSON.stringify(subjects, null, 2) + "\n");

// Local stack: the [auth.email.template.*] and [auth.email.notification.*] sections of
// supabase/config.toml, between the BEGIN/END markers (TOML multi-line literal strings).
const CONFIG = path.join(ROOT, "supabase", "config.toml");
const NOTIFICATIONS = ["password_changed", "email_changed", "mfa_factor_enrolled", "mfa_factor_unenrolled"];
const Q = "'''";
const block = [
  "# BEGIN auth e-mail templates (generated by scripts/generate-auth-email-templates.mjs, do not edit by hand)",
  ...Object.keys(TEMPLATES).flatMap((name) => {
    const notification = name.endsWith("_notification") ? name.replace(/_notification$/, "") : null;
    if (notification && !NOTIFICATIONS.includes(notification)) return [];
    return [
      notification ? `[auth.email.notification.${notification}]` : `[auth.email.template.${name}]`,
      ...(notification ? ["enabled = true"] : []),
      `subject = ${Q}${subjects[name]}${Q}`,
      `content_path = "./supabase/templates/${name}.html"`,
      "",
    ];
  }),
  "# END auth e-mail templates",
].join("\n");
const config = readFileSync(CONFIG, "utf8");
const begin = config.indexOf("# BEGIN auth e-mail templates");
const end = config.indexOf("# END auth e-mail templates");
if (begin < 0 || end < 0) throw new Error("supabase/config.toml: BEGIN/END markers of the auth e-mail templates not found");
writeFileSync(CONFIG, config.slice(0, begin) + block + config.slice(end + "# END auth e-mail templates".length));
console.log(`generate-auth-email-templates: ${Object.keys(TEMPLATES).length} templates written to supabase/templates/`);
