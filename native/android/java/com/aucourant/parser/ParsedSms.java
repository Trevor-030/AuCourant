package com.aucourant.parser;

/** One MoMo message read into fields. The raw text always stays next to the parsed fields. */
public final class ParsedSms {
    /** PARSED: type and amount found. PARTIAL: type known, amount missing. UNREAD: no template matched. */
    public enum Status { PARSED, PARTIAL, UNREAD }

    public final TxType type;
    public final Status status;
    public final Double amount;
    public final Double fee;
    public final Double tax;
    public final Double balance;
    public final String counterpartyName;
    public final String counterpartyNumber;
    public final String merchant;
    public final String rawReference;
    public final String reference;
    public final ReferenceCleaner.Kind referenceKind;
    public final String txId;
    public final String raw;

    ParsedSms(Builder b) {
        this.type = b.type;
        this.amount = b.amount;
        this.fee = b.fee;
        this.tax = b.tax;
        this.balance = b.balance;
        this.counterpartyName = b.counterpartyName;
        this.counterpartyNumber = b.counterpartyNumber;
        this.merchant = b.merchant;
        ReferenceCleaner.Result r = ReferenceCleaner.clean(b.rawReference);
        this.rawReference = r.raw;
        this.reference = r.cleaned;
        this.referenceKind = r.kind;
        this.txId = b.txId;
        this.raw = b.raw;
        this.status = b.type == TxType.UNREAD ? Status.UNREAD : b.amount == null ? Status.PARTIAL : Status.PARSED;
    }

    static ParsedSms unread(String raw) {
        return new Builder(TxType.UNREAD, raw).build();
    }

    static final class Builder {
        final TxType type;
        final String raw;
        Double amount;
        Double fee;
        Double tax;
        Double balance;
        String counterpartyName;
        String counterpartyNumber;
        String merchant;
        String rawReference;
        String txId;

        Builder(TxType type, String raw) {
            this.type = type;
            this.raw = raw;
        }

        ParsedSms build() {
            return new ParsedSms(this);
        }
    }
}
