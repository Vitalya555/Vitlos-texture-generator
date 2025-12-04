export interface Annotation {
  id: string;
  x: number;
  y: number; // Percentages relative to image size (0-100)
  label: string;
}

export interface GenerationState {
  isLoading: boolean;
  resultImage: string | null;
  error: string | null;
}
