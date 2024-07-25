import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = (async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken    //so that user dont need to provide password each time
        await user.save({validateBeforeSave:false})   //so that validations are not checked
        return {accessToken, refreshToken}
    }catch(error){
        throw new ApiError(500, "Internal Server Error")
    }
})

const registerUser = asyncHandler(async (req, res) => {
    const { fullname, username, email, password } = req.body;
    console.log('Received data:', { fullname, username, email, password });

    // Validate input fields
    if (
        [fullname, username, email, password].some(field => field?.trim() === "")
    ) {
        console.log("validation failed")
        throw new ApiError(400, "All fields are required");
    }

    // Check if user already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }
    // Create user
    const user = await User.create({
        fullname,
        email,
        password,
        username
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    if (!createdUser) {
        throw new ApiError(500, "User not found");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    );
});


const loginUser = asyncHandler(async(req,res)=>{
    //req body -> take data
    //username or email ->can login using both or one
    //find the use
    //check if the password is correct if user exist
    //if correct -> return token(access and refresh)
    //send cookies
    //login successful
    const {email,username,password} = req.body
    if(!username || !email){
        throw new ApiError(400,"Username or Email is required")
    }
    const user = await User.findOne({
        $or:[{username},{email}]        //$or is a mongoDB operator
    })
    if(!user){
        throw new ApiError(400,"User not found")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid User Credentias")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser= await User.findById(user._id).
    select("-password -refreshToken")

    const options={         //for cookies
        httpOnly:true,      //can be modified only by server
        secure:true,
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken                
            },
            "Login Successful"
        )
    )
})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {$set:{refreshToken:undefined}},
        {new:true}
    )
    const options={         //for cookies
        httpOnly:true,      //can be modified only by server
        secure:true,
    }
    return res
    .status(200)
    .cookie("accessToken",options)
    .cookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User Logged Out"))
})

export {
    registerUser,
    loginUser,
    logoutUser
}