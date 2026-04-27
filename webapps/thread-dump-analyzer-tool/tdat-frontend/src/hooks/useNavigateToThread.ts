import { useNavigate } from 'react-router-dom';

export function useNavigateToThread(): (threadName: string) => void {
    const navigate = useNavigate();
    return (threadName: string) => {
        navigate('/thread-explorer', { state: { searchThread: threadName } });
    };
}
