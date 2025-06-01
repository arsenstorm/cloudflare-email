import { Hono } from "hono";
import OpenAI from "openai";
import * as PostalMime from "postal-mime";

const base = new Hono();

interface ReceivedEmail {
	from: string;
	to: string;
	raw: ReadableStream<Uint8Array>;
	rawSize: number;
	headers: Headers;

	// Updated with correct Cloudflare Email Workers API types
	setReject: (reason: string) => void;
	forward: (rcptTo: string, headers?: Headers) => Promise<void>;
	reply: (message: EmailMessage) => Promise<void>;
}

const app = Object.assign(base, {
	email: async (message: ReceivedEmail, env: Cloudflare.Env, ctx: any) => {
		const parser = new PostalMime.default();
		const rawEmail = new Response(message.raw);
		const email = await parser.parse(await rawEmail.arrayBuffer());

		console.log("From:", email.from);
		console.log("Subject:", email.subject ?? "No subject");

		const openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY,
		});

		const response = await openai.chat.completions.create({
			model: "gpt-4.1-nano",
			messages: [
				{
					role: "system",
					content:
						"You are a spam filter. You will be given an email and you will need to determine if it is spam or not. You will respond with 'spam' or 'not spam'.",
				},
				{
					role: "user",
					content: `
						Subject: ${email.subject ?? "No subject"}
						Body: ${email.html ?? "No body"}
					`,
				},
			],
		});

		console.log("Response:", response.choices[0].message.content);

		return;
	},
});

export default app;
