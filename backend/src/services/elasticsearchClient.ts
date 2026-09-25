import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env";
import { EmailJobRow } from "../types";

const INDEX = "emails";

let client: Client | null = null;
if (env.elasticsearchUrl) {
  client = new Client({ node: env.elasticsearchUrl });
  client.indices
    .exists({ index: INDEX })
    .then(async (exists) => {
      if (!exists) {
        await client!.indices.create({
          index: INDEX,
          mappings: {
            properties: {
              recipient_email: { type: "keyword" },
              sender_email: { type: "keyword" },
              subject: { type: "text" },
              body: { type: "text" },
              status: { type: "keyword" },
              scheduled_at: { type: "date" },
              sent_at: { type: "date" },
            },
          },
        });
      }
    })
    .catch((err) =>
      console.error("[elasticsearch] index setup failed:", err.message)
    );
} else {
  console.log(
    "[elasticsearch] ELASTICSEARCH_URL not set — search indexing disabled (no-op)."
  );
}

export async function indexEmailJob(job: EmailJobRow): Promise<void> {
  if (!client) return;
  try {
    await client.index({
      index: INDEX,
      id: job.id,
      document: {
        recipient_email: job.recipient_email,
        sender_email: job.sender_email,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduled_at: job.scheduled_at,
        sent_at: job.sent_at,
      },
    });
  } catch (err) {
    console.error("[elasticsearch] index failed:", (err as Error).message);
  }
}

export async function searchEmailJobs(query: string): Promise<any[]> {
  if (!client) return [];
  try {
    const result = await client.search({
      index: INDEX,
      query: {
        multi_match: {
          query,
          fields: ["subject", "body", "recipient_email", "sender_email"],
        },
      },
    });
    return result.hits.hits.map((h) => h._source);
  } catch (err) {
    console.error("[elasticsearch] search failed:", (err as Error).message);
    return [];
  }
}

export const elasticsearchEnabled = !!client;
