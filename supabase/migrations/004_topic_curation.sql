-- Topic curation: parent controls which topics are visible to kids,
-- and can attach guidance notes / reference material for lesson generation.

alter table topics add column approved boolean not null default true;
alter table topics add column guidance_notes text;
alter table topics add column reference_material text;

-- Existing seed and parent-added topics stay approved.
-- New AI-suggested topics will be inserted with approved=false.
