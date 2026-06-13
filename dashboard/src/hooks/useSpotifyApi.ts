import { useCallback } from 'react';

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  owner: { id: string };
  uri: string;
}

export function useSpotifyApi() {
  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/token');
      if (res.ok) {
        const data = await res.json();
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const fetchUserProfile = useCallback(async (token: string) => {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch user profile');
    return await res.json();
  }, []);

  const fetchPlaylists = useCallback(async (): Promise<SpotifyPlaylist[]> => {
    const token = await fetchToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch playlists');
    const data = await res.json();
    return data.items;
  }, [fetchToken]);

  const createPlaylist = useCallback(async (name: string): Promise<SpotifyPlaylist> => {
    const token = await fetchToken();
    if (!token) throw new Error('Not authenticated');

    const user = await fetchUserProfile(token);
    const userId = user.id;

    const res = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description: 'Created by Music Release Agent 🤖',
        public: true
      })
    });
    if (!res.ok) throw new Error('Failed to create playlist');
    return await res.json();
  }, [fetchToken, fetchUserProfile]);

  const addTrackToPlaylist = useCallback(async (playlistId: string, trackUri: string): Promise<void> => {
    const token = await fetchToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [trackUri]
      })
    });
    if (!res.ok) throw new Error('Failed to add track to playlist');
  }, [fetchToken]);

  return { fetchPlaylists, createPlaylist, addTrackToPlaylist };
}
