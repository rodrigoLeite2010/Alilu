-- Extend the configurable marketplace categories without overwriting any
-- custom categories already saved by an administrator.
update desapego_settings
set config = jsonb_set(
  config,
  '{categories}',
  coalesce(config->'categories', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'name', 'Veículos',
      'subcategories', jsonb_build_array(
        'Carros',
        'Motos',
        'Caminhonetes e utilitários',
        'Vans e minivans',
        'Caminhões',
        'Peças e acessórios automotivos'
      )
    )
  )
)
where id = 1
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(config->'categories', '[]'::jsonb)) as category
    where category->>'name' = 'Veículos'
  );
