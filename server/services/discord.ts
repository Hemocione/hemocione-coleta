import { onlyDigits } from "~/utils/cnpj";

export interface BloodBankInterestDiscordNotification {
  bloodBanksLocationId: string;
  bankName: string;
  name: string;
  phone: string;
  institutionId?: string;
  institutionName: string;
  institutionDocument?: string;
  userId?: string;
  origin: "ondedoar";
}

const DISCORD_REQUEST_TIMEOUT_MS = 15_000;

function cleanDiscordValue(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function formatInstitutionDocument(document: string) {
  const digits = onlyDigits(document);
  if (digits.length !== 14) return document;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export async function sendBloodBankInterestToDiscord(
  notification: BloodBankInterestDiscordNotification,
): Promise<{ status: "sent" | "disabled" }> {
  const webhookUrl = useRuntimeConfig().discordBloodBankInterestWebhookUrl?.trim();
  if (!webhookUrl) return { status: "disabled" };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    throw new Error("Discord webhook URL is invalid");
  }
  const allowedHosts = new Set([
    "discord.com",
    "discordapp.com",
    "canary.discord.com",
    "canary.discordapp.com",
    "ptb.discord.com",
    "ptb.discordapp.com",
  ]);
  if (parsedUrl.protocol !== "https:") {
    throw new Error("Discord webhook must use HTTPS");
  }
  if (
    !allowedHosts.has(parsedUrl.hostname) ||
    !parsedUrl.pathname.startsWith("/api/webhooks/")
  ) {
    throw new Error("Discord webhook URL is not allowed");
  }

  const userLabel = cleanDiscordValue(notification.userId || "Anônimo");
  const institutionName = cleanDiscordValue(notification.institutionName);
  const bankName = cleanDiscordValue(notification.bankName);
  const name = cleanDiscordValue(notification.name);
  const phone = cleanDiscordValue(notification.phone);
  const institutionFields = [
    {
      name: "Instituição",
      value: institutionName,
      inline: false,
    },
    ...(notification.institutionDocument
      ? [
          {
            name: "CNPJ",
            value: formatInstitutionDocument(notification.institutionDocument),
            inline: true,
          },
        ]
      : []),
  ];
  const response = await $fetch(webhookUrl, {
    method: "POST",
    timeout: DISCORD_REQUEST_TIMEOUT_MS,
    headers: { "content-type": "application/json" },
    body: {
      embeds: [
        {
          title: "Novo interesse em coleta externa",
          description:
            "Uma instituição demonstrou interesse em organizar uma campanha de doação.",
          color: 0xbb0a08,
          fields: [
            ...institutionFields,
            {
              name: "Banco de sangue",
              value: bankName,
              inline: false,
            },
            {
              name: "Contato",
              value: `${name}\n${phone}`,
              inline: true,
            },
            {
              name: "Usuário",
              value: userLabel,
              inline: true,
            },
            {
              name: "Origem",
              value: notification.origin,
              inline: true,
            },
            {
              name: "Identificador",
              value: notification.bloodBanksLocationId,
              inline: false,
            },
            ...(notification.institutionId
              ? [
                  {
                    name: "ID da instituição",
                    value: notification.institutionId,
                    inline: false,
                  },
                ]
              : []),
          ],
          footer: { text: "Hemocione · Coletas externas" },
          timestamp: new Date().toISOString(),
        },
      ],
      allowed_mentions: { parse: [] },
    },
  });
  if (
    response &&
    typeof response === "object" &&
    "ok" in response &&
    (response as { ok?: unknown }).ok === false
  ) {
    throw new Error("Discord rejected the webhook delivery");
  }

  return { status: "sent" };
}
