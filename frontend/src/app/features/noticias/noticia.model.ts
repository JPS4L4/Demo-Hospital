export interface Noticia {
  id: number;
  titulo: string;
  contenido: string;
  /** Fecha ISO 8601 */
  fecha_publicacion: string;
}

/** Cuerpo de `POST/PUT /noticias`; la fecha de publicación la fija el servidor. */
export type NoticiaInput = Pick<Noticia, 'titulo' | 'contenido'>;
