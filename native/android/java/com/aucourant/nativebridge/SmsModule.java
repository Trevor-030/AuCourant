package com.aucourant.nativebridge;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import com.aucourant.parser.ParsedSms;
import com.aucourant.parser.ParserRegistry;

import java.util.Locale;

/**
 * SMS intake, inbox scan half (architecture.md part 1).
 *
 * Reads raw MoMo messages, and parses message bodies with the parser registry in
 * com.aucourant.parser (MTN templates, several still provisional). The live BroadcastReceiver for new SMS
 * is also still to come; until then a rescan recovers anything missed, since the
 * transaction ID makes imports idempotent.
 *
 * The permission prompt itself is shown from JS (PermissionsAndroid).
 */
public class SmsModule extends ReactContextBaseJavaModule {
    static final String NAME = "AuCourantSms";

    SmsModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void hasPermission(Promise promise) {
        promise.resolve(granted());
    }

    /**
     * @param senders     sender IDs to keep (case-insensitive, e.g. "MobileMoney"); empty keeps all
     * @param sinceMillis only messages at or after this time; 0 for the whole inbox
     * @return array of { id, address, body, date } (date in epoch millis), newest first
     */
    @ReactMethod
    public void readInbox(ReadableArray senders, double sinceMillis, Promise promise) {
        if (!granted()) {
            promise.reject("E_PERMISSION", "Message access is off.");
            return;
        }
        new Thread(() -> {
            Uri inbox = Telephony.Sms.Inbox.CONTENT_URI;
            String[] cols = {Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE};
            String where = Telephony.Sms.DATE + " >= ?";
            String[] args = {String.valueOf((long) sinceMillis)};
            WritableArray out = Arguments.createArray();
            try (Cursor c = getReactApplicationContext().getContentResolver()
                    .query(inbox, cols, where, args, Telephony.Sms.DATE + " DESC")) {
                if (c != null) {
                    while (c.moveToNext()) {
                        String address = c.getString(1);
                        if (!keep(senders, address)) continue;
                        WritableMap m = Arguments.createMap();
                        m.putString("id", c.getString(0));
                        m.putString("address", address);
                        m.putString("body", c.getString(2));
                        m.putDouble("date", c.getLong(3));
                        out.pushMap(m);
                    }
                }
                promise.resolve(out);
            } catch (Exception e) {
                promise.reject("E_READ", "We couldn't finish reading messages.", e);
            }
        }).start();
    }

    /**
     * Parses message bodies with the MTN templates. Nothing is stored.
     *
     * @return one map per body: type, direction, status, amount, fee, tax, balance,
     *         counterpartyName, counterpartyNumber, merchant, rawReference, reference,
     *         referenceKind, txId, raw. Missing values are null.
     */
    @ReactMethod
    public void parseMessages(ReadableArray bodies, Promise promise) {
        WritableArray out = Arguments.createArray();
        for (int i = 0; i < bodies.size(); i++) {
            out.pushMap(toMap(ParserRegistry.mtn().parse(bodies.getString(i))));
        }
        promise.resolve(out);
    }

    private static WritableMap toMap(ParsedSms p) {
        WritableMap m = Arguments.createMap();
        m.putString("type", p.type.name());
        m.putString("direction", p.type.direction.name());
        m.putString("status", p.status.name());
        putNumber(m, "amount", p.amount);
        putNumber(m, "fee", p.fee);
        putNumber(m, "tax", p.tax);
        putNumber(m, "balance", p.balance);
        m.putString("counterpartyName", p.counterpartyName);
        m.putString("counterpartyNumber", p.counterpartyNumber);
        m.putString("merchant", p.merchant);
        m.putString("rawReference", p.rawReference);
        m.putString("reference", p.reference);
        m.putString("referenceKind", p.referenceKind.name());
        m.putString("txId", p.txId);
        m.putString("raw", p.raw);
        return m;
    }

    private static void putNumber(WritableMap m, String key, Double v) {
        if (v == null) m.putNull(key);
        else m.putDouble(key, v);
    }

    private boolean granted() {
        return ContextCompat.checkSelfPermission(getReactApplicationContext(), Manifest.permission.READ_SMS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private static boolean keep(ReadableArray senders, String address) {
        if (senders == null || senders.size() == 0) return true;
        if (address == null) return false;
        String a = address.toLowerCase(Locale.ROOT);
        for (int i = 0; i < senders.size(); i++) {
            String s = senders.getString(i);
            if (s != null && a.contains(s.toLowerCase(Locale.ROOT))) return true;
        }
        return false;
    }
}
