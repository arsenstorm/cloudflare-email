// Hono
import { Hono } from "hono";

// Email
import * as PostalMime from "postal-mime";
import { createMimeMessage } from "mimetext";
import { EmailMessage as CloudflareEmailMessage } from "cloudflare:email";

// OpenAI
import OpenAI from "openai";

const base = new Hono();

interface ReceivedEmail {
	from: string;
	to: string;
	raw: ReadableStream<Uint8Array>;
	rawSize: number;
	headers: Headers;
	setReject: (reason: string) => void;
	forward: (rcptTo: string, headers?: Headers) => Promise<void>;
	reply: (message: EmailMessage) => Promise<void>;
}

const app = Object.assign(base, {
	email: async (message: ReceivedEmail, env: Cloudflare.Env, ctx: any) => {
		const parser = new PostalMime.default();
		const rawEmail = new Response(message.raw);
		const email = await parser.parse(await rawEmail.arrayBuffer());

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

		if (response.choices[0].message.content === "spam") {
			message.setReject("This email was rejected as spam");
			return;
		}

		const msg = createMimeMessage();
		msg.setSender({
			addr: message.to,
		});
		msg.setRecipient(email.from.address as string);
		msg.setHeader("In-Reply-To", email.messageId);
		msg.setSubject(`Re: ${email.subject}`);
		msg.addMessage({
			contentType: "text/plain",
			data: "We've received your email and will handle it as soon as possible.",
		});

		const replyMessage = new CloudflareEmailMessage(
			message.to,
			message.from,
			msg.asRaw(),
		);

		// Reply to the sender
		//await message.reply(replyMessage);

		// Forward to specified email
		if (env.FORWARD_EMAIL) {
			await message.forward(env.FORWARD_EMAIL);
		}

		return;
	},
});

export default app;
