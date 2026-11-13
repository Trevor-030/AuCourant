package com.aucourant.parser;

/** One message template. Returns null when the message is not this type. */
public interface SmsParser {
    ParsedSms parse(String body);
}
