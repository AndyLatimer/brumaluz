-- Permisos: las funciones internas no son invocables; las acciones, solo por usuarios con sesión.
revoke all on function
  public.game_race_bonus(text, text), public.game_level(jsonb), public.game_xp_needed(int),
  public.game_attr_total(jsonb, text), public.game_max_health(jsonb), public.game_health(jsonb),
  public.game_points_spent(jsonb), public.game_points_allowed(jsonb), public.game_lock_character(uuid),
  public.game_store(uuid, jsonb), public.game_require_debug(), public.game_overheal_cap(jsonb), public.game_overheal_now(jsonb),
  public.game_regen_data(uuid,jsonb),public.game_combat_tick(uuid,jsonb,double precision,double precision),
  public.game_item(text), public.game_vendor_stock(text), public.game_pelines(jsonb), public.game_set_pelines(jsonb, int),
  public.game_inventory(jsonb), public.game_add_item(jsonb, text), public.game_remove_item(jsonb, int), public.game_title_granted(text)
  from public, anon, authenticated;

revoke all on function public.my_titles() from public, anon;
grant execute on function public.my_titles() to authenticated;

revoke all on function
  public.create_character(jsonb), public.character_enter(uuid), public.respawn_character(uuid),
  public.debug_damage(uuid), public.debug_heal(uuid), public.debug_xp(uuid), public.debug_money(uuid),
  public.vendor_buy(uuid, text, text), public.vendor_sell(uuid, text, int), public.use_item(uuid, int),
  public.spend_attribute_points(uuid, jsonb), public.set_character_title(uuid, text),
  public.save_character_position(uuid, double precision, double precision, double precision), public.chat_send(uuid, text, text, text),
  public.combat_start(uuid),public.combat_action(uuid,text),public.combat_stop(uuid)
  from public, anon;
grant execute on function
  public.create_character(jsonb), public.character_enter(uuid), public.respawn_character(uuid),
  public.debug_damage(uuid), public.debug_heal(uuid), public.debug_xp(uuid), public.debug_money(uuid),
  public.vendor_buy(uuid, text, text), public.vendor_sell(uuid, text, int), public.use_item(uuid, int),
  public.spend_attribute_points(uuid, jsonb), public.set_character_title(uuid, text),
  public.save_character_position(uuid, double precision, double precision, double precision), public.chat_send(uuid, text, text, text),
  public.combat_start(uuid),public.combat_action(uuid,text),public.combat_stop(uuid)
  to authenticated;

