import { z } from "zod";

export const createImageSchema = z.object({
  menuId: z
    .coerce.number({ invalid_type_error: "menuId debe ser numérico" })
    .int("menuId debe ser entero")
    .positive("menuId debe ser mayor que 0"),
  url: z
    .string({ required_error: "La URL es obligatoria" })
    .url("La URL no es válida"),
});

export const updateImageSchema = z.object({
  url: z.string().url("La URL no es válida").optional(),
  active: z.boolean().optional(),
});

export const upsertItemImageSchema = z
  .object({
    id: z.number().int().positive().optional(),
    url: z.string().url("La URL no es válida").optional(),
    fileField: z.string().min(1, "fileField no puede ser vacío").optional(),
    alt: z
      .string()
      .max(255, "El alt no puede superar 255 caracteres")
      .nullable()
      .optional(),
    sortOrder: z
      .coerce.number()
      .int()
      .min(0, "sortOrder no puede ser negativo")
      .optional(),
    active: z.boolean().optional(),
    _delete: z.boolean().optional(),
  })
  .superRefine((img, ctx) => {
    const isUpdate = img.id != null;
    const isDelete = img._delete === true;
    const hasFile =
      typeof img.fileField === "string" && img.fileField.length > 0;
    const hasUrl = typeof img.url === "string" && img.url.length > 0;
    const hasMetaChanges =
      img.alt !== undefined ||
      img.sortOrder !== undefined ||
      img.active !== undefined;

    // 1) BORRADO: _delete = true → tiene que venir id
    if (isDelete) {
      if (!isUpdate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Para borrar una imagen debés enviar el 'id' de la imagen",
          path: ["id"],
        });
      }
      // si _delete es true y hay id, no seguimos validando nada más
      return;
    }

    // 2) UPDATE: viene id sin _delete
    if (isUpdate) {
      // Caso raro: viene id pero no hay ni url/fileField ni cambios de meta
      if (!hasFile && !hasUrl && !hasMetaChanges) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Para actualizar una imagen debés cambiar al menos 'url', 'fileField', 'alt', 'sortOrder' o 'active'",
          path: ["id"],
        });
      }
      return; // update válido (aunque la issue puede saltar si no hay cambios)
    }

    // 3) CREATE: no viene id ni _delete
    if (!hasFile && !hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Para crear una imagen nueva debés enviar 'fileField' con un archivo o una 'url' válida",
        path: ["fileField"], // apunto a fileField, pero el mensaje menciona ambas
      });
    }
  });

export const upsertItemImagesBodySchema = z.object({
  images: z.preprocess(
    (raw) => {
      // En multipart/form-data, "images" llega como string JSON: "[{...}, {...}]"
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch {
          // si el JSON está mal formado, dejamos el string para que Zod marque el tipo inválido
          return raw;
        }
      }
      // si ya es array (por ejemplo, en tests internos), se usa tal cual
      return raw;
    },
    z
      .array(upsertItemImageSchema)
      .min(1, "Debe enviar al menos una imagen")
  ),
});
