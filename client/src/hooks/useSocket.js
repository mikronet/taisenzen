import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

export function useSocket() {
  const socketRef = useRef(null);

  if (!socketRef.current) {
    socketRef.current = io(URL, { autoConnect: false });
  }

  useEffect(() => {
    socketRef.current.connect();
    return () => socketRef.current.disconnect();
  }, []);

  return socketRef.current;
}
