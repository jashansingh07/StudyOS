const API_BASE_URL = "http://127.0.0.1:8000";

export interface Subject {
  id: number;
  name: string;
  user_id: number;
}

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
    throw new Error(`Failed to fetch subjects: ${response.status}`);
  }

  return response.json();
}