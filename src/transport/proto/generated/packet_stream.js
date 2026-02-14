/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const scrop = $root.scrop = (() => {

    /**
     * Namespace scrop.
     * @exports scrop
     * @namespace
     */
    const scrop = {};

    scrop.packet = (function() {

        /**
         * Namespace packet.
         * @memberof scrop
         * @namespace
         */
        const packet = {};

        packet.PacketBatchEnvelope = (function() {

            /**
             * Properties of a PacketBatchEnvelope.
             * @memberof scrop.packet
             * @interface IPacketBatchEnvelope
             * @property {number|null} [schemaVersion] PacketBatchEnvelope schemaVersion
             * @property {Array.<scrop.packet.ICapturedPacket>|null} [packets] PacketBatchEnvelope packets
             */

            /**
             * Constructs a new PacketBatchEnvelope.
             * @memberof scrop.packet
             * @classdesc Represents a PacketBatchEnvelope.
             * @implements IPacketBatchEnvelope
             * @constructor
             * @param {scrop.packet.IPacketBatchEnvelope=} [properties] Properties to set
             */
            function PacketBatchEnvelope(properties) {
                this.packets = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * PacketBatchEnvelope schemaVersion.
             * @member {number} schemaVersion
             * @memberof scrop.packet.PacketBatchEnvelope
             * @instance
             */
            PacketBatchEnvelope.prototype.schemaVersion = 0;

            /**
             * PacketBatchEnvelope packets.
             * @member {Array.<scrop.packet.ICapturedPacket>} packets
             * @memberof scrop.packet.PacketBatchEnvelope
             * @instance
             */
            PacketBatchEnvelope.prototype.packets = $util.emptyArray;

            /**
             * Creates a new PacketBatchEnvelope instance using the specified properties.
             * @function create
             * @memberof scrop.packet.PacketBatchEnvelope
             * @static
             * @param {scrop.packet.IPacketBatchEnvelope=} [properties] Properties to set
             * @returns {scrop.packet.PacketBatchEnvelope} PacketBatchEnvelope instance
             */
            PacketBatchEnvelope.create = function create(properties) {
                return new PacketBatchEnvelope(properties);
            };

            /**
             * Encodes the specified PacketBatchEnvelope message. Does not implicitly {@link scrop.packet.PacketBatchEnvelope.verify|verify} messages.
             * @function encode
             * @memberof scrop.packet.PacketBatchEnvelope
             * @static
             * @param {scrop.packet.IPacketBatchEnvelope} message PacketBatchEnvelope message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            PacketBatchEnvelope.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.schemaVersion != null && Object.hasOwnProperty.call(message, "schemaVersion"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.schemaVersion);
                if (message.packets != null && message.packets.length)
                    for (let i = 0; i < message.packets.length; ++i)
                        $root.scrop.packet.CapturedPacket.encode(message.packets[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified PacketBatchEnvelope message, length delimited. Does not implicitly {@link scrop.packet.PacketBatchEnvelope.verify|verify} messages.
             * @function encodeDelimited
             * @memberof scrop.packet.PacketBatchEnvelope
             * @static
             * @param {scrop.packet.IPacketBatchEnvelope} message PacketBatchEnvelope message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            PacketBatchEnvelope.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a PacketBatchEnvelope message from the specified reader or buffer.
             * @function decode
             * @memberof scrop.packet.PacketBatchEnvelope
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {scrop.packet.PacketBatchEnvelope} PacketBatchEnvelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            PacketBatchEnvelope.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scrop.packet.PacketBatchEnvelope();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.schemaVersion = reader.uint32();
                            break;
                        }
                    case 2: {
                            if (!(message.packets && message.packets.length))
                                message.packets = [];
                            message.packets.push($root.scrop.packet.CapturedPacket.decode(reader, reader.uint32()));
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a PacketBatchEnvelope message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof scrop.packet.PacketBatchEnvelope
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {scrop.packet.PacketBatchEnvelope} PacketBatchEnvelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            PacketBatchEnvelope.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a PacketBatchEnvelope message.
             * @function verify
             * @memberof scrop.packet.PacketBatchEnvelope
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            PacketBatchEnvelope.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.schemaVersion != null && message.hasOwnProperty("schemaVersion"))
                    if (!$util.isInteger(message.schemaVersion))
                        return "schemaVersion: integer expected";
                if (message.packets != null && message.hasOwnProperty("packets")) {
                    if (!Array.isArray(message.packets))
                        return "packets: array expected";
                    for (let i = 0; i < message.packets.length; ++i) {
                        let error = $root.scrop.packet.CapturedPacket.verify(message.packets[i]);
                        if (error)
                            return "packets." + error;
                    }
                }
                return null;
            };

            /**
             * Creates a PacketBatchEnvelope message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof scrop.packet.PacketBatchEnvelope
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {scrop.packet.PacketBatchEnvelope} PacketBatchEnvelope
             */
            PacketBatchEnvelope.fromObject = function fromObject(object) {
                if (object instanceof $root.scrop.packet.PacketBatchEnvelope)
                    return object;
                let message = new $root.scrop.packet.PacketBatchEnvelope();
                if (object.schemaVersion != null)
                    message.schemaVersion = object.schemaVersion >>> 0;
                if (object.packets) {
                    if (!Array.isArray(object.packets))
                        throw TypeError(".scrop.packet.PacketBatchEnvelope.packets: array expected");
                    message.packets = [];
                    for (let i = 0; i < object.packets.length; ++i) {
                        if (typeof object.packets[i] !== "object")
                            throw TypeError(".scrop.packet.PacketBatchEnvelope.packets: object expected");
                        message.packets[i] = $root.scrop.packet.CapturedPacket.fromObject(object.packets[i]);
                    }
                }
                return message;
            };

            /**
             * Creates a plain object from a PacketBatchEnvelope message. Also converts values to other types if specified.
             * @function toObject
             * @memberof scrop.packet.PacketBatchEnvelope
             * @static
             * @param {scrop.packet.PacketBatchEnvelope} message PacketBatchEnvelope
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            PacketBatchEnvelope.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.arrays || options.defaults)
                    object.packets = [];
                if (options.defaults)
                    object.schemaVersion = 0;
                if (message.schemaVersion != null && message.hasOwnProperty("schemaVersion"))
                    object.schemaVersion = message.schemaVersion;
                if (message.packets && message.packets.length) {
                    object.packets = [];
                    for (let j = 0; j < message.packets.length; ++j)
                        object.packets[j] = $root.scrop.packet.CapturedPacket.toObject(message.packets[j], options);
                }
                return object;
            };

            /**
             * Converts this PacketBatchEnvelope to JSON.
             * @function toJSON
             * @memberof scrop.packet.PacketBatchEnvelope
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            PacketBatchEnvelope.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for PacketBatchEnvelope
             * @function getTypeUrl
             * @memberof scrop.packet.PacketBatchEnvelope
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            PacketBatchEnvelope.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/scrop.packet.PacketBatchEnvelope";
            };

            return PacketBatchEnvelope;
        })();

        packet.CapturedPacket = (function() {

            /**
             * Properties of a CapturedPacket.
             * @memberof scrop.packet
             * @interface ICapturedPacket
             * @property {scrop.packet.IAnimatingPacket|null} [packet] CapturedPacket packet
             * @property {scrop.packet.PacketResult|null} [result] CapturedPacket result
             */

            /**
             * Constructs a new CapturedPacket.
             * @memberof scrop.packet
             * @classdesc Represents a CapturedPacket.
             * @implements ICapturedPacket
             * @constructor
             * @param {scrop.packet.ICapturedPacket=} [properties] Properties to set
             */
            function CapturedPacket(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * CapturedPacket packet.
             * @member {scrop.packet.IAnimatingPacket|null|undefined} packet
             * @memberof scrop.packet.CapturedPacket
             * @instance
             */
            CapturedPacket.prototype.packet = null;

            /**
             * CapturedPacket result.
             * @member {scrop.packet.PacketResult} result
             * @memberof scrop.packet.CapturedPacket
             * @instance
             */
            CapturedPacket.prototype.result = 0;

            /**
             * Creates a new CapturedPacket instance using the specified properties.
             * @function create
             * @memberof scrop.packet.CapturedPacket
             * @static
             * @param {scrop.packet.ICapturedPacket=} [properties] Properties to set
             * @returns {scrop.packet.CapturedPacket} CapturedPacket instance
             */
            CapturedPacket.create = function create(properties) {
                return new CapturedPacket(properties);
            };

            /**
             * Encodes the specified CapturedPacket message. Does not implicitly {@link scrop.packet.CapturedPacket.verify|verify} messages.
             * @function encode
             * @memberof scrop.packet.CapturedPacket
             * @static
             * @param {scrop.packet.ICapturedPacket} message CapturedPacket message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            CapturedPacket.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.packet != null && Object.hasOwnProperty.call(message, "packet"))
                    $root.scrop.packet.AnimatingPacket.encode(message.packet, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                if (message.result != null && Object.hasOwnProperty.call(message, "result"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.result);
                return writer;
            };

            /**
             * Encodes the specified CapturedPacket message, length delimited. Does not implicitly {@link scrop.packet.CapturedPacket.verify|verify} messages.
             * @function encodeDelimited
             * @memberof scrop.packet.CapturedPacket
             * @static
             * @param {scrop.packet.ICapturedPacket} message CapturedPacket message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            CapturedPacket.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a CapturedPacket message from the specified reader or buffer.
             * @function decode
             * @memberof scrop.packet.CapturedPacket
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {scrop.packet.CapturedPacket} CapturedPacket
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            CapturedPacket.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scrop.packet.CapturedPacket();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.packet = $root.scrop.packet.AnimatingPacket.decode(reader, reader.uint32());
                            break;
                        }
                    case 2: {
                            message.result = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a CapturedPacket message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof scrop.packet.CapturedPacket
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {scrop.packet.CapturedPacket} CapturedPacket
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            CapturedPacket.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a CapturedPacket message.
             * @function verify
             * @memberof scrop.packet.CapturedPacket
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            CapturedPacket.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.packet != null && message.hasOwnProperty("packet")) {
                    let error = $root.scrop.packet.AnimatingPacket.verify(message.packet);
                    if (error)
                        return "packet." + error;
                }
                if (message.result != null && message.hasOwnProperty("result"))
                    switch (message.result) {
                    default:
                        return "result: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                        break;
                    }
                return null;
            };

            /**
             * Creates a CapturedPacket message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof scrop.packet.CapturedPacket
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {scrop.packet.CapturedPacket} CapturedPacket
             */
            CapturedPacket.fromObject = function fromObject(object) {
                if (object instanceof $root.scrop.packet.CapturedPacket)
                    return object;
                let message = new $root.scrop.packet.CapturedPacket();
                if (object.packet != null) {
                    if (typeof object.packet !== "object")
                        throw TypeError(".scrop.packet.CapturedPacket.packet: object expected");
                    message.packet = $root.scrop.packet.AnimatingPacket.fromObject(object.packet);
                }
                switch (object.result) {
                default:
                    if (typeof object.result === "number") {
                        message.result = object.result;
                        break;
                    }
                    break;
                case "PACKET_RESULT_UNSPECIFIED":
                case 0:
                    message.result = 0;
                    break;
                case "PACKET_RESULT_DELIVERED":
                case 1:
                    message.result = 1;
                    break;
                case "PACKET_RESULT_NIC_DROP":
                case 2:
                    message.result = 2;
                    break;
                case "PACKET_RESULT_FW_DROP":
                case 3:
                    message.result = 3;
                    break;
                }
                return message;
            };

            /**
             * Creates a plain object from a CapturedPacket message. Also converts values to other types if specified.
             * @function toObject
             * @memberof scrop.packet.CapturedPacket
             * @static
             * @param {scrop.packet.CapturedPacket} message CapturedPacket
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            CapturedPacket.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.packet = null;
                    object.result = options.enums === String ? "PACKET_RESULT_UNSPECIFIED" : 0;
                }
                if (message.packet != null && message.hasOwnProperty("packet"))
                    object.packet = $root.scrop.packet.AnimatingPacket.toObject(message.packet, options);
                if (message.result != null && message.hasOwnProperty("result"))
                    object.result = options.enums === String ? $root.scrop.packet.PacketResult[message.result] === undefined ? message.result : $root.scrop.packet.PacketResult[message.result] : message.result;
                return object;
            };

            /**
             * Converts this CapturedPacket to JSON.
             * @function toJSON
             * @memberof scrop.packet.CapturedPacket
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            CapturedPacket.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for CapturedPacket
             * @function getTypeUrl
             * @memberof scrop.packet.CapturedPacket
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            CapturedPacket.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/scrop.packet.CapturedPacket";
            };

            return CapturedPacket;
        })();

        packet.AnimatingPacket = (function() {

            /**
             * Properties of an AnimatingPacket.
             * @memberof scrop.packet
             * @interface IAnimatingPacket
             * @property {string|null} [id] AnimatingPacket id
             * @property {scrop.packet.Protocol|null} [protocol] AnimatingPacket protocol
             * @property {number|null} [size] AnimatingPacket size
             * @property {string|null} [source] AnimatingPacket source
             * @property {number|null} [srcPort] AnimatingPacket srcPort
             * @property {string|null} [destination] AnimatingPacket destination
             * @property {number|null} [destPort] AnimatingPacket destPort
             * @property {number|null} [targetPort] AnimatingPacket targetPort
             * @property {number|null} [timestamp] AnimatingPacket timestamp
             * @property {string|null} [reason] AnimatingPacket reason
             * @property {number|null} [captureMonoNs] AnimatingPacket captureMonoNs
             */

            /**
             * Constructs a new AnimatingPacket.
             * @memberof scrop.packet
             * @classdesc Represents an AnimatingPacket.
             * @implements IAnimatingPacket
             * @constructor
             * @param {scrop.packet.IAnimatingPacket=} [properties] Properties to set
             */
            function AnimatingPacket(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * AnimatingPacket id.
             * @member {string} id
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.id = "";

            /**
             * AnimatingPacket protocol.
             * @member {scrop.packet.Protocol} protocol
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.protocol = 0;

            /**
             * AnimatingPacket size.
             * @member {number} size
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.size = 0;

            /**
             * AnimatingPacket source.
             * @member {string} source
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.source = "";

            /**
             * AnimatingPacket srcPort.
             * @member {number} srcPort
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.srcPort = 0;

            /**
             * AnimatingPacket destination.
             * @member {string} destination
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.destination = "";

            /**
             * AnimatingPacket destPort.
             * @member {number} destPort
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.destPort = 0;

            /**
             * AnimatingPacket targetPort.
             * @member {number|null|undefined} targetPort
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.targetPort = null;

            /**
             * AnimatingPacket timestamp.
             * @member {number} timestamp
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.timestamp = 0;

            /**
             * AnimatingPacket reason.
             * @member {string|null|undefined} reason
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.reason = null;

            /**
             * AnimatingPacket captureMonoNs.
             * @member {number|null|undefined} captureMonoNs
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             */
            AnimatingPacket.prototype.captureMonoNs = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(AnimatingPacket.prototype, "_targetPort", {
                get: $util.oneOfGetter($oneOfFields = ["targetPort"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(AnimatingPacket.prototype, "_reason", {
                get: $util.oneOfGetter($oneOfFields = ["reason"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            // Virtual OneOf for proto3 optional field
            Object.defineProperty(AnimatingPacket.prototype, "_captureMonoNs", {
                get: $util.oneOfGetter($oneOfFields = ["captureMonoNs"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new AnimatingPacket instance using the specified properties.
             * @function create
             * @memberof scrop.packet.AnimatingPacket
             * @static
             * @param {scrop.packet.IAnimatingPacket=} [properties] Properties to set
             * @returns {scrop.packet.AnimatingPacket} AnimatingPacket instance
             */
            AnimatingPacket.create = function create(properties) {
                return new AnimatingPacket(properties);
            };

            /**
             * Encodes the specified AnimatingPacket message. Does not implicitly {@link scrop.packet.AnimatingPacket.verify|verify} messages.
             * @function encode
             * @memberof scrop.packet.AnimatingPacket
             * @static
             * @param {scrop.packet.IAnimatingPacket} message AnimatingPacket message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            AnimatingPacket.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.protocol != null && Object.hasOwnProperty.call(message, "protocol"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.protocol);
                if (message.size != null && Object.hasOwnProperty.call(message, "size"))
                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.size);
                if (message.source != null && Object.hasOwnProperty.call(message, "source"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.source);
                if (message.srcPort != null && Object.hasOwnProperty.call(message, "srcPort"))
                    writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.srcPort);
                if (message.destination != null && Object.hasOwnProperty.call(message, "destination"))
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.destination);
                if (message.destPort != null && Object.hasOwnProperty.call(message, "destPort"))
                    writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.destPort);
                if (message.targetPort != null && Object.hasOwnProperty.call(message, "targetPort"))
                    writer.uint32(/* id 8, wireType 0 =*/64).uint32(message.targetPort);
                if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
                    writer.uint32(/* id 9, wireType 1 =*/73).double(message.timestamp);
                if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                    writer.uint32(/* id 10, wireType 2 =*/82).string(message.reason);
                if (message.captureMonoNs != null && Object.hasOwnProperty.call(message, "captureMonoNs"))
                    writer.uint32(/* id 11, wireType 1 =*/89).double(message.captureMonoNs);
                return writer;
            };

            /**
             * Encodes the specified AnimatingPacket message, length delimited. Does not implicitly {@link scrop.packet.AnimatingPacket.verify|verify} messages.
             * @function encodeDelimited
             * @memberof scrop.packet.AnimatingPacket
             * @static
             * @param {scrop.packet.IAnimatingPacket} message AnimatingPacket message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            AnimatingPacket.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes an AnimatingPacket message from the specified reader or buffer.
             * @function decode
             * @memberof scrop.packet.AnimatingPacket
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {scrop.packet.AnimatingPacket} AnimatingPacket
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            AnimatingPacket.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scrop.packet.AnimatingPacket();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.protocol = reader.int32();
                            break;
                        }
                    case 3: {
                            message.size = reader.uint32();
                            break;
                        }
                    case 4: {
                            message.source = reader.string();
                            break;
                        }
                    case 5: {
                            message.srcPort = reader.uint32();
                            break;
                        }
                    case 6: {
                            message.destination = reader.string();
                            break;
                        }
                    case 7: {
                            message.destPort = reader.uint32();
                            break;
                        }
                    case 8: {
                            message.targetPort = reader.uint32();
                            break;
                        }
                    case 9: {
                            message.timestamp = reader.double();
                            break;
                        }
                    case 10: {
                            message.reason = reader.string();
                            break;
                        }
                    case 11: {
                            message.captureMonoNs = reader.double();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes an AnimatingPacket message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof scrop.packet.AnimatingPacket
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {scrop.packet.AnimatingPacket} AnimatingPacket
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            AnimatingPacket.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies an AnimatingPacket message.
             * @function verify
             * @memberof scrop.packet.AnimatingPacket
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            AnimatingPacket.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                let properties = {};
                if (message.id != null && message.hasOwnProperty("id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.protocol != null && message.hasOwnProperty("protocol"))
                    switch (message.protocol) {
                    default:
                        return "protocol: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                        break;
                    }
                if (message.size != null && message.hasOwnProperty("size"))
                    if (!$util.isInteger(message.size))
                        return "size: integer expected";
                if (message.source != null && message.hasOwnProperty("source"))
                    if (!$util.isString(message.source))
                        return "source: string expected";
                if (message.srcPort != null && message.hasOwnProperty("srcPort"))
                    if (!$util.isInteger(message.srcPort))
                        return "srcPort: integer expected";
                if (message.destination != null && message.hasOwnProperty("destination"))
                    if (!$util.isString(message.destination))
                        return "destination: string expected";
                if (message.destPort != null && message.hasOwnProperty("destPort"))
                    if (!$util.isInteger(message.destPort))
                        return "destPort: integer expected";
                if (message.targetPort != null && message.hasOwnProperty("targetPort")) {
                    properties._targetPort = 1;
                    if (!$util.isInteger(message.targetPort))
                        return "targetPort: integer expected";
                }
                if (message.timestamp != null && message.hasOwnProperty("timestamp"))
                    if (typeof message.timestamp !== "number")
                        return "timestamp: number expected";
                if (message.reason != null && message.hasOwnProperty("reason")) {
                    properties._reason = 1;
                    if (!$util.isString(message.reason))
                        return "reason: string expected";
                }
                if (message.captureMonoNs != null && message.hasOwnProperty("captureMonoNs")) {
                    properties._captureMonoNs = 1;
                    if (typeof message.captureMonoNs !== "number")
                        return "captureMonoNs: number expected";
                }
                return null;
            };

            /**
             * Creates an AnimatingPacket message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof scrop.packet.AnimatingPacket
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {scrop.packet.AnimatingPacket} AnimatingPacket
             */
            AnimatingPacket.fromObject = function fromObject(object) {
                if (object instanceof $root.scrop.packet.AnimatingPacket)
                    return object;
                let message = new $root.scrop.packet.AnimatingPacket();
                if (object.id != null)
                    message.id = String(object.id);
                switch (object.protocol) {
                default:
                    if (typeof object.protocol === "number") {
                        message.protocol = object.protocol;
                        break;
                    }
                    break;
                case "PROTOCOL_UNSPECIFIED":
                case 0:
                    message.protocol = 0;
                    break;
                case "PROTOCOL_TCP":
                case 1:
                    message.protocol = 1;
                    break;
                case "PROTOCOL_UDP":
                case 2:
                    message.protocol = 2;
                    break;
                }
                if (object.size != null)
                    message.size = object.size >>> 0;
                if (object.source != null)
                    message.source = String(object.source);
                if (object.srcPort != null)
                    message.srcPort = object.srcPort >>> 0;
                if (object.destination != null)
                    message.destination = String(object.destination);
                if (object.destPort != null)
                    message.destPort = object.destPort >>> 0;
                if (object.targetPort != null)
                    message.targetPort = object.targetPort >>> 0;
                if (object.timestamp != null)
                    message.timestamp = Number(object.timestamp);
                if (object.reason != null)
                    message.reason = String(object.reason);
                if (object.captureMonoNs != null)
                    message.captureMonoNs = Number(object.captureMonoNs);
                return message;
            };

            /**
             * Creates a plain object from an AnimatingPacket message. Also converts values to other types if specified.
             * @function toObject
             * @memberof scrop.packet.AnimatingPacket
             * @static
             * @param {scrop.packet.AnimatingPacket} message AnimatingPacket
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            AnimatingPacket.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.id = "";
                    object.protocol = options.enums === String ? "PROTOCOL_UNSPECIFIED" : 0;
                    object.size = 0;
                    object.source = "";
                    object.srcPort = 0;
                    object.destination = "";
                    object.destPort = 0;
                    object.timestamp = 0;
                }
                if (message.id != null && message.hasOwnProperty("id"))
                    object.id = message.id;
                if (message.protocol != null && message.hasOwnProperty("protocol"))
                    object.protocol = options.enums === String ? $root.scrop.packet.Protocol[message.protocol] === undefined ? message.protocol : $root.scrop.packet.Protocol[message.protocol] : message.protocol;
                if (message.size != null && message.hasOwnProperty("size"))
                    object.size = message.size;
                if (message.source != null && message.hasOwnProperty("source"))
                    object.source = message.source;
                if (message.srcPort != null && message.hasOwnProperty("srcPort"))
                    object.srcPort = message.srcPort;
                if (message.destination != null && message.hasOwnProperty("destination"))
                    object.destination = message.destination;
                if (message.destPort != null && message.hasOwnProperty("destPort"))
                    object.destPort = message.destPort;
                if (message.targetPort != null && message.hasOwnProperty("targetPort")) {
                    object.targetPort = message.targetPort;
                    if (options.oneofs)
                        object._targetPort = "targetPort";
                }
                if (message.timestamp != null && message.hasOwnProperty("timestamp"))
                    object.timestamp = options.json && !isFinite(message.timestamp) ? String(message.timestamp) : message.timestamp;
                if (message.reason != null && message.hasOwnProperty("reason")) {
                    object.reason = message.reason;
                    if (options.oneofs)
                        object._reason = "reason";
                }
                if (message.captureMonoNs != null && message.hasOwnProperty("captureMonoNs")) {
                    object.captureMonoNs = options.json && !isFinite(message.captureMonoNs) ? String(message.captureMonoNs) : message.captureMonoNs;
                    if (options.oneofs)
                        object._captureMonoNs = "captureMonoNs";
                }
                return object;
            };

            /**
             * Converts this AnimatingPacket to JSON.
             * @function toJSON
             * @memberof scrop.packet.AnimatingPacket
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            AnimatingPacket.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for AnimatingPacket
             * @function getTypeUrl
             * @memberof scrop.packet.AnimatingPacket
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            AnimatingPacket.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/scrop.packet.AnimatingPacket";
            };

            return AnimatingPacket;
        })();

        /**
         * Protocol enum.
         * @name scrop.packet.Protocol
         * @enum {number}
         * @property {number} PROTOCOL_UNSPECIFIED=0 PROTOCOL_UNSPECIFIED value
         * @property {number} PROTOCOL_TCP=1 PROTOCOL_TCP value
         * @property {number} PROTOCOL_UDP=2 PROTOCOL_UDP value
         */
        packet.Protocol = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "PROTOCOL_UNSPECIFIED"] = 0;
            values[valuesById[1] = "PROTOCOL_TCP"] = 1;
            values[valuesById[2] = "PROTOCOL_UDP"] = 2;
            return values;
        })();

        /**
         * PacketResult enum.
         * @name scrop.packet.PacketResult
         * @enum {number}
         * @property {number} PACKET_RESULT_UNSPECIFIED=0 PACKET_RESULT_UNSPECIFIED value
         * @property {number} PACKET_RESULT_DELIVERED=1 PACKET_RESULT_DELIVERED value
         * @property {number} PACKET_RESULT_NIC_DROP=2 PACKET_RESULT_NIC_DROP value
         * @property {number} PACKET_RESULT_FW_DROP=3 PACKET_RESULT_FW_DROP value
         */
        packet.PacketResult = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "PACKET_RESULT_UNSPECIFIED"] = 0;
            values[valuesById[1] = "PACKET_RESULT_DELIVERED"] = 1;
            values[valuesById[2] = "PACKET_RESULT_NIC_DROP"] = 2;
            values[valuesById[3] = "PACKET_RESULT_FW_DROP"] = 3;
            return values;
        })();

        return packet;
    })();

    return scrop;
})();

export { $root as default };
