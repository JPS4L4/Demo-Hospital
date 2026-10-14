export interface Noticia {
  id: number;
  titulo: string;
  contenido: string;
  /** Fecha ISO 8601 */
  fecha_publicacion: string;
}
