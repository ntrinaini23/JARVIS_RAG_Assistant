import re
from typing import List, Dict

class SentenceAwareChunker:
    @staticmethod
    def split_into_sentences(text: str) -> List[str]:
        """Splits text into sentences using regex boundary detection."""
        # Split on period, exclamation, or question mark followed by space or newline
        sentence_endings = re.compile(r'(?<=[.!?])\s+')
        sentences = sentence_endings.split(text)
        return [s.strip() for s in sentences if s.strip()]

    @classmethod
    def chunk_text(cls, text: str, chunk_size: int = 512, chunk_overlap: int = 64) -> List[Dict[str, any]]:
        """
        Chunks text into blocks of roughly `chunk_size` characters with `chunk_overlap` overlap.
        Respects sentence boundaries to avoid splitting in the middle of sentences.
        """
        sentences = cls.split_into_sentences(text)
        chunks = []
        
        current_chunk = []
        current_length = 0
        
        for idx, sentence in enumerate(sentences):
            sentence_len = len(sentence)
            
            # If a single sentence exceeds the chunk size, we treat it as its own chunk
            if sentence_len >= chunk_size:
                if current_chunk:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = []
                    current_length = 0
                chunks.append(sentence)
                continue
                
            # If adding this sentence exceeds chunk_size, we save current chunk and start new one
            if current_length + sentence_len + (1 if current_chunk else 0) > chunk_size:
                # Save current chunk
                chunk_text = " ".join(current_chunk)
                chunks.append(chunk_text)
                
                # Rollback for overlap: look back at previous sentences to satisfy overlap
                overlap_text_list = []
                overlap_len = 0
                for prev_sentence in reversed(current_chunk):
                    if overlap_len + len(prev_sentence) + (1 if overlap_text_list else 0) <= chunk_overlap:
                        overlap_text_list.insert(0, prev_sentence)
                        overlap_len += len(prev_sentence) + 1
                    else:
                        break
                
                current_chunk = overlap_text_list + [sentence]
                current_length = sum(len(s) for s in current_chunk) + len(current_chunk) - 1
            else:
                current_chunk.append(sentence)
                current_length += sentence_len + (1 if len(current_chunk) > 1 else 0)
                
        # Append any remaining text
        if current_chunk:
            chunks.append(" ".join(current_chunk))
            
        # Format chunks as dicts with index
        formatted_chunks = []
        for i, chunk in enumerate(chunks):
            formatted_chunks.append({
                "chunk_index": i,
                "text": chunk
            })
            
        return formatted_chunks
