create type public.app_role as enum ('admin','seller','buyer');
create type public.vehicle_status as enum ('draft','verifying','blocked','pending_review','listed','reserved','sold_active','paid_off','delisted');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  phone text,
  state text,
  city text,
  fee_waived boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.state_rules (
  state text primary key,
  max_apr numeric(5,2) not null,
  annual_sale_limit int not null,
  updated_at timestamptz not null default now()
);
grant select on public.state_rules to anon, authenticated;
grant all on public.state_rules to service_role;
grant insert, update, delete on public.state_rules to authenticated;
alter table public.state_rules enable row level security;
create policy "Anyone reads state rules" on public.state_rules for select to anon, authenticated using (true);
create policy "Admins manage state rules" on public.state_rules for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.state_rules values ('AZ',10,5),('TX',18,5),('FL',18,5),('CA',10,3),('NY',16,3),('other',12,5);

create table public.platform_settings (
  id int primary key default 1 check (id = 1),
  fee_rate numeric(5,4) not null default 0.10,
  inspection_price_cents int not null default 9900,
  updated_at timestamptz not null default now()
);
grant select on public.platform_settings to anon, authenticated;
grant update on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;
alter table public.platform_settings enable row level security;
create policy "Anyone reads settings" on public.platform_settings for select to anon, authenticated using (true);
create policy "Admins update settings" on public.platform_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));
insert into public.platform_settings default values;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid,
  seller_display_name text not null default '',
  seller_verified boolean not null default true,
  vin text not null,
  year int not null, make text not null, model text not null, trim text,
  body text, mileage int not null default 0, exterior_color text, interior_color text,
  condition text, description text,
  city text not null, state text not null, zip text,
  price_cents int not null,
  min_down_pct numeric(5,2) not null default 15,
  apr numeric(5,2) not null,
  allowed_terms int[] not null default '{36,48,60}',
  market_low_cents int, market_high_cents int,
  photos text[] not null default '{}',
  features text[] not null default '{}',
  history_summary jsonb not null default '{}'::jsonb,
  status vehicle_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.vehicles to anon;
grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
create policy "Public reads listed" on public.vehicles for select to anon, authenticated using (status in ('listed','reserved'));
create policy "Seller reads own" on public.vehicles for select to authenticated using (seller_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Seller inserts own" on public.vehicles for insert to authenticated with check (seller_id = auth.uid());
create policy "Seller updates own" on public.vehicles for update to authenticated using (seller_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, state)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'state');
  if (new.raw_user_meta_data->>'role') in ('seller','buyer') then
    insert into public.user_roles (user_id, role) values (new.id, (new.raw_user_meta_data->>'role')::app_role);
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.vehicles (seller_display_name, vin, year, make, model, trim, body, mileage, exterior_color, condition, description, city, state, price_cents, min_down_pct, apr, allowed_terms, market_low_cents, market_high_cents, photos, features, history_summary, status) values
('Maria A.','1HGCV1F34LA012345',2020,'Honda','Accord','Sport 1.5T','Sedan',41200,'Platinum White','Excellent','One owner, garage kept, all service records.','Phoenix','AZ',2200000,15,10,'{36,48,60}',2050000,2350000,'{https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=1200}','{"Apple CarPlay","Lane assist","Heated seats"}','{"owners":1,"accidents":0,"title":"clean"}','listed'),
('Maria A.','5YJ3E1EA7KF312345',2019,'Tesla','Model 3','Standard Range Plus','Sedan',52000,'Midnight Silver','Very good','Autopilot, new tires 2025.','Scottsdale','AZ',2650000,20,9.5,'{36,48}',2500000,2800000,'{https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=1200}','{"Autopilot","Glass roof"}','{"owners":1,"accidents":0,"title":"clean"}','listed'),
('James T.','1FTEW1EP5JFA12345',2018,'Ford','F-150','XLT','Truck',78400,'Magnetic Gray','Good','Tow package, bed liner.','Austin','TX',2480000,15,14,'{36,48,60}',2300000,2600000,'{https://images.unsplash.com/photo-1605893477799-b99e3b8b93fe?w=1200}','{"Tow package","4x4"}','{"owners":2,"accidents":0,"title":"clean"}','listed'),
('James T.','2T1BURHE0KC123456',2019,'Toyota','Corolla','LE','Sedan',36100,'Blue Crush','Excellent','Great commuter, 34 mpg.','Houston','TX',1550000,10,12,'{24,36,48}',1450000,1650000,'{https://images.unsplash.com/photo-1623869675781-80aa31012a5a?w=1200}','{"Backup camera","Bluetooth"}','{"owners":1,"accidents":0,"title":"clean"}','listed'),
('Priya N.','JM1DKFC75K1412345',2019,'Mazda','CX-3','Touring','SUV',44800,'Soul Red','Very good','Compact SUV, AWD.','Miami','FL',1690000,15,11,'{36,48}',1600000,1800000,'{https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=1200}','{"AWD","Blind spot monitor"}','{"owners":1,"accidents":1,"title":"clean"}','listed'),
('Priya N.','WBA8E9G51GNT12345',2016,'BMW','3 Series','328i','Sedan',88000,'Jet Black','Good','Sport package.','Orlando','FL',1390000,20,16,'{24,36}',1250000,1450000,'{https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200}','{"Sport package","Navigation"}','{"owners":2,"accidents":0,"title":"clean"}','listed'),
('Ken W.','5NPE34AF4JH612345',2018,'Hyundai','Sonata','SEL','Sedan',61000,'Phantom Black','Good','Reliable, clean interior.','San Diego','CA',1290000,10,10,'{24,36,48}',1200000,1400000,'{https://images.unsplash.com/photo-1629897048514-3dd7414fe72a?w=1200}','{"Heated seats","Apple CarPlay"}','{"owners":1,"accidents":0,"title":"clean"}','listed'),
('Ken W.','1C4RJFAG5FC123456',2015,'Jeep','Grand Cherokee','Laredo','SUV',98000,'Granite Crystal','Fair','Runs great, some cosmetic wear.','Sacramento','CA',1450000,15,9,'{24,36}',1350000,1550000,'{https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200}','{"4x4","Leather"}','{"owners":3,"accidents":1,"title":"clean"}','reserved'),
('Lena R.','4S4BSANC5K3312345',2019,'Subaru','Outback','Premium','Wagon',47000,'Crystal White','Very good','Winter-ready, roof rack.','Buffalo','NY',2150000,15,13,'{36,48,60}',2000000,2300000,'{https://images.unsplash.com/photo-1626072557464-90403d788e8e?w=1200}','{"AWD","Roof rack","EyeSight"}','{"owners":1,"accidents":0,"title":"clean"}','listed'),
('Lena R.','1G1ZD5ST8LF012345',2020,'Chevrolet','Malibu','LT','Sedan',33000,'Mosaic Black','Excellent','Low miles.','Albany','NY',1750000,10,15,'{36,48,60}',1650000,1850000,'{https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200}','{"Remote start","Wi-Fi hotspot"}','{"owners":1,"accidents":0,"title":"clean"}','listed');