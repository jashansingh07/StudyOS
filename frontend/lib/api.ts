const API_BASE_URL = "http://127.0.0.1:8000";

export interface Subject {
id: number;
name: string;
user_id: number;
}

export interface Source {
document_id: number;
page: number | null;
chunk_id: number;
similarity: number;
}

export interface AskQuestionResponse {
conversation_id: number;
subject_id: number;
subject_name: string;
question: string;
answer: string;
sources: Source[];
message_id: number;
}

export interface Conversation {
id: number;
subject_id: number;
title: string;
created_at: string;
updated_at: string;
}

export interface SavedMessage {
id: number;
conversation_id?: number;
role: "user" | "assistant";
content: string;
created_at: string;
}

export interface ConversationMessagesResponse {
conversation_id?: number;
id?: number;
subject_id: number;
title: string;
messages: SavedMessage[];
}

async function readError(response: Response): Promise<string> {
const error = await response.json().catch(() => null);

if (typeof error?.detail === "string") {
return error.detail;
}

return `Request failed (${response.status})`;
}

// Fetch all subjects belonging to a user.
export async function getSubjects(
userId: number,
accessToken: string
): Promise<Subject[]> {
const response = await fetch(
`${API_BASE_URL}/users/${userId}/subjects`,
{
method: "GET",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json",
},
}
);

if (!response.ok) {
throw new Error(await readError(response));
}

return response.json();
}

// Create a new subject.
export async function createSubject(
name: string,
accessToken: string
): Promise<Subject> {
const response = await fetch(
`${API_BASE_URL}/subjects?name=${encodeURIComponent(name)}`,
{
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
},
}
);

if (!response.ok) {
throw new Error(await readError(response));
}

return response.json();
}

// Ask a question and optionally continue an existing conversation.
export async function askQuestion(
subjectId: number,
question: string,
accessToken: string,
conversationId: number | null = null
): Promise<AskQuestionResponse> {
const response = await fetch(
`${API_BASE_URL}/subjects/${subjectId}/ask`,
{
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json",
},
body: JSON.stringify({
question,
conversation_id: conversationId,
}),
}
);

if (!response.ok) {
throw new Error(await readError(response));
}

return response.json();
}

// Retrieve saved conversations for a particular subject.
export async function getConversations(
subjectId: number,
accessToken: string
): Promise<Conversation[]> {
const response = await fetch(
`${API_BASE_URL}/subjects/${subjectId}/conversations`,
{
method: "GET",
headers: {
Authorization: `Bearer ${accessToken}`,
},
}
);

if (!response.ok) {
throw new Error(await readError(response));
}

return response.json();
}

// Retrieve all saved messages in a conversation.
export async function getConversationMessages(
conversationId: number,
accessToken: string
): Promise<ConversationMessagesResponse> {
const response = await fetch(
`${API_BASE_URL}/conversations/${conversationId}/messages`,
{
method: "GET",
headers: {
Authorization: `Bearer ${accessToken}`,
},
}
);

if (!response.ok) {
throw new Error(await readError(response));
}

return response.json();
}
