import { Hono } from "hono";

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
		console.log("Email received:", message);
		console.log("From:", message.from);
		console.log("Subject:", message.headers.get("Subject"));

		// Your email processing logic here
		// You can access message.from, message.headers, message.reply(), etc.

		return;
	},
});

export default app;
