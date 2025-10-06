// Local storage utilities for meetings

export interface Meeting {
  id: string;
  name: string;
  folder: string;
  transcript: string;
  interimTranscript: string;
  isPaused: boolean;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'meetings';
const FOLDERS_KEY = 'folders';

export const getMeetings = (): Meeting[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveMeeting = (meeting: Meeting): void => {
  const meetings = getMeetings();
  const index = meetings.findIndex(m => m.id === meeting.id);
  
  if (index >= 0) {
    meetings[index] = meeting;
  } else {
    meetings.push(meeting);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
};

export const getMeeting = (id: string): Meeting | null => {
  const meetings = getMeetings();
  return meetings.find(m => m.id === id) || null;
};

export const deleteMeeting = (id: string): void => {
  const meetings = getMeetings().filter(m => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
};

export const getFolders = (): string[] => {
  try {
    const data = localStorage.getItem(FOLDERS_KEY);
    return data ? JSON.parse(data) : ['Allmänt'];
  } catch {
    return ['Allmänt'];
  }
};

export const addFolder = (folder: string): void => {
  const folders = getFolders();
  if (!folders.includes(folder)) {
    folders.push(folder);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }
};

export const deleteFolder = (folder: string): void => {
  const folders = getFolders().filter(f => f !== folder);
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  
  // Move meetings from deleted folder to 'Allmänt'
  const meetings = getMeetings();
  meetings.forEach(m => {
    if (m.folder === folder) {
      m.folder = 'Allmänt';
    }
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
};
