-- analysis_images에 GPS 컬럼 추가 (드론 촬영 EXIF 데이터)
alter table public.analysis_images
  add column if not exists gps_lat      double precision,
  add column if not exists gps_lng      double precision,
  add column if not exists gps_altitude double precision;
