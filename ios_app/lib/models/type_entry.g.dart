// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'type_entry.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class TypeEntryAdapter extends TypeAdapter<TypeEntry> {
  @override
  final int typeId = 2;

  @override
  TypeEntry read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return TypeEntry(
      id: fields[0] as String,
      text: fields[1] as String,
      timestamp: fields[2] as DateTime,
    );
  }

  @override
  void write(BinaryWriter writer, TypeEntry obj) {
    writer
      ..writeByte(3)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.text)
      ..writeByte(2)
      ..write(obj.timestamp);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TypeEntryAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
