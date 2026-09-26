-- Correct the initial import's timezone conversion; never alter edited records.
UPDATE content SET published_at='2026-09-12',data=json_set(data,'$.publishedAt','2026-09-12') WHERE id='seed-why-domestic-manufacturing' AND revision=1 AND published_at='2026-09-11';
UPDATE content SET published_at='2026-08-28',data=json_set(data,'$.publishedAt','2026-08-28') WHERE id='seed-reading-a-fabric-spec' AND revision=1 AND published_at='2026-08-27';
UPDATE content SET published_at='2026-08-03',data=json_set(data,'$.publishedAt','2026-08-03') WHERE id='seed-case-study-capsule-launch' AND revision=1 AND published_at='2026-08-02';
UPDATE content SET published_at='2026-07-16',data=json_set(data,'$.publishedAt','2026-07-16') WHERE id='seed-garment-dye-explained' AND revision=1 AND published_at='2026-07-15';
