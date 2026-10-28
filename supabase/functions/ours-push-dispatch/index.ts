// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
  Urgency,
} from './vendor/webpush/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const expectedSecret = Deno.env.get('OURS_PUSH_DISPATCH_SECRET') || '';
  const authorization = request.headers.get('Authorization') || '';
  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('OURS_SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const publicJwkRaw = Deno.env.get('VAPID_PUBLIC_JWK') || '';
  const privateJwkRaw = Deno.env.get('VAPID_PRIVATE_JWK') || '';
  const subject = Deno.env.get('VAPID_SUBJECT') || '';
  if (!supabaseUrl || !serviceRoleKey || !publicJwkRaw || !privateJwkRaw || !subject) {
    return json({ error: 'PUSH_ENV_NOT_CONFIGURED' }, 503);
  }

  let vapidKeys;
  let pushServer;
  try {
    vapidKeys = await importVapidKeys({
      publicKey: JSON.parse(publicJwkRaw),
      privateKey: JSON.parse(privateJwkRaw),
    });
    pushServer = await ApplicationServer.new({ contactInformation: subject, vapidKeys });
  } catch {
    return json({ error: 'INVALID_VAPID_KEYS' }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: deliveries, error: claimError } = await supabase.rpc('ours_claim_push_deliveries', { p_limit: 50 });
  if (claimError) return json({ error: 'CLAIM_FAILED', detail: claimError.message }, 500);

  const summary = { claimed: deliveries?.length || 0, sent: 0, failed: 0, expired: 0 };
  for (const delivery of deliveries || []) {
    try {
      const subscriber = pushServer.subscribe({
        endpoint: delivery.endpoint,
        keys: { p256dh: delivery.p256dh, auth: delivery.auth_secret },
      });
      await subscriber.pushTextMessage(
        JSON.stringify({
          eventId: delivery.event_id,
          category: delivery.category,
          targetRoute: delivery.target_route,
          targetAnchor: delivery.target_anchor,
          title: delivery.title,
          body: delivery.body,
        }),
        { ttl: 3600, urgency: Urgency.Normal, topic: String(delivery.event_id).slice(0, 30) },
      );
      summary.sent += 1;
      await supabase.rpc('ours_complete_push_delivery', {
        p_delivery_id: delivery.delivery_id,
        p_status: 'sent',
        p_error_code: '',
      });
    } catch (error) {
      const statusCode = error instanceof PushMessageError ? error.response.status : 0;
      const expired = error instanceof PushMessageError ? (error.response.status === 404 || error.isGone()) : false;
      summary[expired ? 'expired' : 'failed'] += 1;
      await supabase.rpc('ours_complete_push_delivery', {
        p_delivery_id: delivery.delivery_id,
        p_status: expired ? 'expired' : 'failed',
        p_error_code: String(statusCode || error?.code || 'PUSH_SEND_FAILED').slice(0, 120),
      });
    }
  }

  return json({ ok: true, ...summary });
});
