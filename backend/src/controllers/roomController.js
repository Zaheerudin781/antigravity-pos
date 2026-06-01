const Room = require('../models/Room');
const Table = require('../models/Table');

exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ tenantId: req.tenantId }).sort({ name: 1 });
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Room name is required' });

    const room = await Room.create({
      tenantId: req.tenantId,
      name,
      description
    });
    res.status(201).json({ success: true, room });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Room/Floor name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const { name, description } = req.body;
    const oldRoom = await Room.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!oldRoom) {
      return res.status(404).json({ success: false, message: 'Room/Floor not found' });
    }

    const oldName = oldRoom.name;

    oldRoom.name = name || oldRoom.name;
    oldRoom.description = description !== undefined ? description : oldRoom.description;

    await oldRoom.save();

    // If name changed, update all tables in this section/room
    if (name && oldName !== name) {
      await Table.updateMany(
        { tenantId: req.tenantId, section: oldName },
        { $set: { section: name } }
      );
    }

    res.json({ success: true, room: oldRoom });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Room/Floor name already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room/Floor not found' });
    }

    // Set any Tables using this room to default 'Main Room'
    await Table.updateMany(
      { tenantId: req.tenantId, section: room.name },
      { $set: { section: 'Main Room' } }
    );

    // Make sure 'Main Room' exists in Room model or create it
    const mainRoomExists = await Room.findOne({ tenantId: req.tenantId, name: 'Main Room' });
    if (!mainRoomExists) {
      const tableCount = await Table.countDocuments({ tenantId: req.tenantId, section: 'Main Room' });
      if (tableCount > 0) {
        await Room.create({ tenantId: req.tenantId, name: 'Main Room', description: 'Default Main Dining Room' });
      }
    }

    await room.deleteOne();
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
