-- Visibility switches are public configuration, including false rows; otherwise
-- the client cannot distinguish hidden from missing and would display a hidden block.
drop policy blocks_read on public.home_blocks;
create policy blocks_read on public.home_blocks for select to anon,authenticated using (true);
