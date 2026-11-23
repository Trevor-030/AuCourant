package com.aucourant.nativebridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import com.aucourant.parser.MomoSenders;
import com.aucourant.sorting.Model;

import java.util.concurrent.TimeUnit;

/**
 * SMS intake, live half (architecture.md part 1). Android calls this for every SMS; only MoMo
 * senders are looked at. The message itself is not used: it is read from the inbox like every other
 * one, so it has the same id and is never counted twice. The phone's messages app may take a moment
 * to put it there, so this waits briefly. A message missed here is found by the next scan.
 *
 * Declared in the manifest by plugins/with-aucourant-native.js, for the system only (BROADCAST_SMS).
 */
public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "AuCourantSms";
    /** Pauses before each look at the inbox. Android allows a receiver about 10 seconds in all. */
    private static final long[] PAUSES_MS = {300, 700, 1000, 2000};
    private static final long SCAN_LIMIT_S = 5;
    /** The inbox time of the message can differ a little from the phone's clock. */
    private static final long LOOK_BACK_MS = 10 * 60 * 1000;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        String body = momoBody(intent);
        if (body == null) return;
        Context app = context.getApplicationContext();
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                if (!SmsModule.granted(app)) return;
                waitForInbox(app, body);
                StoreModule.messageArrived(app).get(SCAN_LIMIT_S, TimeUnit.SECONDS);
            } catch (Exception e) {
                // Never the message itself: logs can be read over USB.
                Log.w(TAG, "New message not read yet: " + e.getClass().getSimpleName());
            } finally {
                pending.finish();
            }
        }).start();
    }

    /** The text of a MoMo message, its parts joined, or null when it is from anyone else. */
    private static String momoBody(Intent intent) {
        SmsMessage[] parts;
        try {
            parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        } catch (RuntimeException e) {
            return null;
        }
        if (parts == null || parts.length == 0) return null;
        StringBuilder body = new StringBuilder();
        for (SmsMessage p : parts) {
            if (p == null || !MomoSenders.matches(p.getDisplayOriginatingAddress())) return null;
            if (p.getDisplayMessageBody() != null) body.append(p.getDisplayMessageBody());
        }
        return body.toString().trim();
    }

    /** Returns when the message is in the inbox, or after the last pause (the scan then looks anyway). */
    private static void waitForInbox(Context app, String body) throws InterruptedException {
        long since = System.currentTimeMillis() - LOOK_BACK_MS;
        for (long pause : PAUSES_MS) {
            Thread.sleep(pause);
            for (Model.Sms sms : SmsModule.readInbox(app, since)) {
                if (sms.body != null && sms.body.trim().equals(body)) return;
            }
        }
    }
}
