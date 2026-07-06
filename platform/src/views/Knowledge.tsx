import { useSearchParams } from 'react-router-dom';
import { KnowledgeGraph } from '../components/KnowledgeGraph';

export function Knowledge() {
  const [params] = useSearchParams();
  const initialFocus = params.get('focus');
  // key forces a fresh graph instance when the deep-linked focus changes
  return <KnowledgeGraph key={initialFocus || 'root'} initialFocus={initialFocus} />;
}
