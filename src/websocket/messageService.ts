import pool from "../db";

export async function saveMessage(
    senderId:number,
    receivedId : number,
    content : string
):Promise<number>{
    const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, content, delivered) 
        VALUES ($1, $2, $3, $4) RETURNING id`,
        [senderId, receivedId, content, false]
    );
    return result.rows[0].id;    
}

export async function markDelivered(messageId:number): Promise<void>{
    await pool.query(
        `UPDATE messages SET delivered = true WHERE id= $1`,
        [messageId]
    );
}

export async function getUndeliveredMessages(userId:number) {
    const result = await pool.query(
        `SELECT m.id, m.sender_id, m.content, m.created_at
        FROM messages m
        WHERE m.receiver_id = $1
        AND m.delivered = false
        ORDER BY m.created_at ASC`,
        [userId]
    );
    return result.rows;    
}
