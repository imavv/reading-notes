// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'voice_entry.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class VoiceEntryAdapter extends TypeAdapter<VoiceEntry> {
  @override
  final int typeId = 1;

  @override
  VoiceEntry read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return VoiceEntry(
      id: fields[0] as String,
      rawText: fields[1] as String,
      timestamp: fields[2] as DateTime,
    );
  }

  @override
  void write(BinaryWriter writer, VoiceEntry obj) {
    writer
      ..writeByte(3)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.rawText)
      ..writeByte(2)
      ..write(obj.timestamp);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is VoiceEntryAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
